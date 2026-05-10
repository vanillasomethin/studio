// Content library — list and initiate upload.
// GET  /api/content         → { content: Content[] }
// POST /api/content         → { id, uploadUrl, objectKey }  (client uploads to R2, then calls /api/content/[id]/complete)
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signedUploadUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows    = await db.content.findMany({ orderBy: { createdAt: 'desc' } });
    const content = rows.map((c) => ({ ...c, url: publicUrl(c.objectKey) }));
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, type, sizeBytes, md5, durationMs } = await req.json() as {
      name: string;
      type: 'image' | 'video';
      sizeBytes: number;
      md5: string;
      durationMs?: number;
    };
    if (!name || !type || !sizeBytes || !md5) {
      return NextResponse.json({ error: 'name, type, sizeBytes, md5 required' }, { status: 400 });
    }

    const ext       = type === 'video' ? 'mp4' : 'jpg';
    const objectKey = `content/${randomUUID()}.${ext}`;
    const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';

    const uploadUrl = await signedUploadUrl(objectKey, contentType, 900); // 15 min

    const content = await db.content.create({
      data: { name, type, objectKey, md5, sizeBytes, durationMs: durationMs ?? null },
    });

    return NextResponse.json({ id: content.id, uploadUrl, objectKey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
