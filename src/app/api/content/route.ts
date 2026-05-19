// Content library — list, initiate upload, and manage metadata.
// GET   /api/content          → { content: Content[], totalBytes }  (optional ?folder= ?tag=)
// POST  /api/content          → { id, uploadUrl, objectKey }
// PATCH /api/content          → bulk update tags/folder by id
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signedUploadUrl, publicUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const folder = req.nextUrl.searchParams.get('folder');
    const tag    = req.nextUrl.searchParams.get('tag');
    const rows = await db.content.findMany({
      where: {
        ...(folder ? { folder } : {}),
        ...(tag    ? { tags: { has: tag } } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
    });
    const totalBytes = rows.reduce((s, c) => s + Number(c.sizeBytes), 0);
    const content = rows.map((c) => ({
      id:         c.id,
      name:       c.name,
      type:       c.type.toLowerCase() as 'image' | 'video',
      objectKey:  c.objectKey,
      url:        publicUrl(c.objectKey),
      md5:        c.md5,
      sizeBytes:  Number(c.sizeBytes),
      durationMs: c.durationMs ?? undefined,
      createdAt:  c.uploadedAt.toISOString(),
      tags:       c.tags,
      folder:     c.folder ?? undefined,
    }));
    return NextResponse.json({ content, totalBytes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, type, sizeBytes, md5, durationMs, mimeType } = await req.json() as {
      name: string;
      type: 'image' | 'video';
      sizeBytes: number;
      md5: string;
      durationMs?: number;
      mimeType?: string;
    };
    if (!name || !type || !sizeBytes || !md5) {
      return NextResponse.json({ error: 'name, type, sizeBytes, md5 required' }, { status: 400 });
    }

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
      data: { name, type: dbType, objectKey, md5, sizeBytes, durationMs: durationMs ?? null },
    });

    return NextResponse.json({ id: content.id, uploadUrl, objectKey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, tags, folder } = await req.json() as { id: string; tags?: string[]; folder?: string | null };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updated = await db.content.update({
      where: { id },
      data: {
        ...(tags   !== undefined ? { tags }   : {}),
        ...(folder !== undefined ? { folder } : {}),
      },
    });
    return NextResponse.json({ id: updated.id, tags: updated.tags, folder: updated.folder });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
