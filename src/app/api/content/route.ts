// Content library — list, initiate upload, and manage metadata.
// GET   /api/content          → { content: Content[], totalBytes }  (optional ?folder= ?tag=)
// POST  /api/content          → { id, uploadUrl, objectKey }
// PATCH /api/content          → bulk update tags/folder by id
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signedUploadUrl, publicUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const BASE_CONTENT_SELECT = {
  id: true, name: true, type: true, objectKey: true,
  md5: true, sizeBytes: true, durationMs: true, uploadedAt: true,
  width: true, height: true,
};

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const folder = req.nextUrl.searchParams.get('folder');
    const tag    = req.nextUrl.searchParams.get('tag');
    // '' (the literal) selects house content — the rows with no brand — which is a
    // real filter, not "no filter". Hence the null check rather than a truthy one.
    const brand  = req.nextUrl.searchParams.get('brand');

    // Fetch base rows without tags/folder (columns may not exist yet in DB)
    const rows = await db.content.findMany({
      select: BASE_CONTENT_SELECT,
      orderBy: { uploadedAt: 'desc' },
    });

    // Attempt to fetch tags/folder/transcodeStatus/brand separately — safe to fail.
    // brandId rides along in this same fail-open query rather than BASE_CONTENT_SELECT
    // on purpose: if the column is ever missing (a deploy that outran its migration),
    // the library still lists, minus the brand labels. Putting it in the main select
    // would 500 the whole Content tab instead.
    type TagRow = {
      id: string; tags: string[]; folder: string | null;
      transcodeStatus: string | null; transcodeError: string | null;
      brandId: string | null; brandName: string | null;
    };
    let tagMap = new Map<string, TagRow>();
    try {
      const tagRows = await db.$queryRaw<TagRow[]>`
        SELECT c.id, c.tags, c.folder, c."transcodeStatus", c."transcodeError",
               c."brandId", b."brandName"
        FROM "Content" c
        LEFT JOIN "Brand" b ON b.id = c."brandId"
      `;
      tagMap = new Map(tagRows.map((r) => [r.id, r]));
    } catch { /* columns not yet migrated — tags/folder/transcode/brand stay empty */ }

    // Filter by folder/tag if requested (post-query, since WHERE may fail without columns)
    const filtered = rows.filter((c) => {
      const extra = tagMap.get(c.id);
      if (folder && extra?.folder !== folder) return false;
      if (tag    && !(extra?.tags ?? []).includes(tag)) return false;
      if (brand !== null && (extra?.brandId ?? '') !== brand) return false;
      return true;
    });

    const totalBytes = filtered.reduce((s, c) => s + Number(c.sizeBytes), 0);
    const content = filtered.map((c) => {
      const extra = tagMap.get(c.id);
      return {
        id:         c.id,
        name:       c.name,
        type:       c.type.toLowerCase() as 'image' | 'video',
        objectKey:  c.objectKey,
        url:        publicUrl(c.objectKey),
        md5:        c.md5,
        sizeBytes:  Number(c.sizeBytes),
        durationMs: c.durationMs ?? undefined,
        width:      c.width ?? undefined,
        height:     c.height ?? undefined,
        createdAt:  c.uploadedAt.toISOString(),
        tags:       extra?.tags ?? [],
        folder:     extra?.folder ?? undefined,
        brandId:    extra?.brandId ?? null,
        brandName:  extra?.brandName ?? null,
        transcodeStatus: (extra?.transcodeStatus as 'pending' | 'done' | 'error' | null) ?? undefined,
        transcodeError:  extra?.transcodeError ?? undefined,
      };
    });
    return NextResponse.json({ content, totalBytes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { name, type, sizeBytes, md5, durationMs, mimeType, width, height, brandId } = await req.json() as {
      name: string;
      type: 'image' | 'video';
      sizeBytes: number;
      md5: string;
      durationMs?: number;
      mimeType?: string;
      width?: number;
      height?: number;
      brandId?: string | null;
    };
    if (!name || !type || !sizeBytes || !md5) {
      return NextResponse.json({ error: 'name, type, sizeBytes, md5 required' }, { status: 400 });
    }

    // Check the brand up front so a bad id fails as a 400 naming the problem rather
    // than an FK violation surfacing as an opaque 500 — this runs before the R2
    // presign, so a rejected upload leaves no orphaned object key behind either.
    if (brandId) {
      const brand = await db.brand.findUnique({ where: { id: brandId }, select: { id: true } });
      if (!brand) return NextResponse.json({ error: 'Unknown brand' }, { status: 400 });
    }

    // Intrinsic pixel size, measured client-side before upload (images). Both or
    // neither — a lone dimension can't drive the aspect-ratio letterbox warning.
    const dims = Number.isFinite(width) && Number.isFinite(height) && width! > 0 && height! > 0
      ? { width: Math.round(width!), height: Math.round(height!) }
      : {};

    const MIME_TO_EXT: Record<string, string> = {
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext         = MIME_TO_EXT[mimeType ?? ''] ?? (type === 'video' ? 'mp4' : 'jpg');
    const contentType = mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
    const objectKey   = `content/${randomUUID()}.${ext}`;
    const dbType      = type === 'video' ? 'VIDEO' : 'IMAGE';

    const uploadUrl = await signedUploadUrl(objectKey, contentType, 900);

    const content = await db.content.create({
      data: { name, type: dbType, objectKey, md5, sizeBytes, durationMs: durationMs ?? null, brandId: brandId ?? null, ...dims },
    });

    // This hands back a presigned R2 PUT URL — the point where new media enters
    // the platform. Logged with the object key so an unrecognised asset on a
    // screen can be traced back to who introduced it.
    await logAdminAction({
      actor, req,
      action: 'content.create',
      target: content.id,
      meta:   { name, type, sizeBytes, objectKey },
    });

    return NextResponse.json({ id: content.id, uploadUrl, objectKey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { id, tags, folder, brandId } = await req.json() as {
      id: string; tags?: string[]; folder?: string | null; brandId?: string | null;
    };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Validate before the write. The raw-SQL fallback below exists to survive a
    // missing COLUMN, but it cannot tell that apart from a bad brand id — without
    // this check an unknown brand would fall through it and surface as a 500.
    // null is a legitimate value here: it unassigns the creative back to house.
    if (brandId) {
      const brand = await db.brand.findUnique({ where: { id: brandId }, select: { id: true } });
      if (!brand) return NextResponse.json({ error: 'Unknown brand' }, { status: 400 });
    }

    try {
      const updated = await db.content.update({
        where: { id },
        data: {
          ...(tags    !== undefined ? { tags }    : {}),
          ...(folder  !== undefined ? { folder }  : {}),
          ...(brandId !== undefined ? { brandId } : {}),
        },
      });
      await logAdminAction({ actor, req, action: 'content.update', target: id, meta: { tags, folder, brandId } });
      return NextResponse.json({
        id:      updated.id,
        tags:    (updated as { tags?: string[] }).tags ?? [],
        folder:  (updated as { folder?: string | null }).folder ?? null,
        brandId: (updated as { brandId?: string | null }).brandId ?? null,
      });
    } catch {
      // Fallback: update via raw SQL if ORM fails on missing column
      if (tags !== undefined) {
        await db.$executeRaw`UPDATE "Content" SET tags = ${tags}::text[] WHERE id = ${id}`;
      }
      if (folder !== undefined) {
        await db.$executeRaw`UPDATE "Content" SET folder = ${folder} WHERE id = ${id}`;
      }
      if (brandId !== undefined) {
        await db.$executeRaw`UPDATE "Content" SET "brandId" = ${brandId} WHERE id = ${id}`;
      }
      await logAdminAction({ actor, req, action: 'content.update', target: id, meta: { tags, folder, brandId, viaRawSql: true } });
      return NextResponse.json({ id, tags: tags ?? [], folder: folder ?? null, brandId: brandId ?? null });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
