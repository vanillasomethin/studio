// Content library — list and initiate upload.
// GET  /api/content         → { content: Content[] }
// POST /api/content         → { id, uploadUrl, objectKey }  (client uploads to R2, then calls /api/content/[id]/complete)
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
    const rows    = await db.content.findMany({ orderBy: { uploadedAt: 'desc' } });
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
    const dbType    = type === 'video' ? 'VIDEO' : 'IMAGE';

    const uploadUrl = await signedUploadUrl(objectKey, contentType, 900); // 15 min

    const content = await db.content.create({
      data: { name, type: dbType, objectKey, md5, sizeBytes, durationMs: durationMs ?? null },
    });

    return NextResponse.json({ id: content.id, uploadUrl, objectKey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
