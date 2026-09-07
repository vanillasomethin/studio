// POST /api/admin/transcode — kicks off background re-encode of a video Content row
// to H.264 Main@4.1 (see transcode-lambda/). Fire-and-forget: the Lambda calls back
// /api/admin/transcode-callback when done. Body: { contentId }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicUrl } from '@/lib/r2';
import { triggerTranscode } from '@/lib/transcode-lambda';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { contentId } = await req.json().catch(() => ({})) as { contentId?: string };
  if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });

  try {
    const content = await db.content.findUnique({ where: { id: contentId } });
    if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    if (content.type !== 'VIDEO') return NextResponse.json({ error: 'Only video content can be transcoded' }, { status: 400 });

    // Transcode from the preserved original when there is one — re-encoding the
    // rendition would stack generation loss.
    const sourceKey = content.originalObjectKey ?? content.objectKey;
    await triggerTranscode(contentId, publicUrl(sourceKey));

    try {
      await db.content.update({
        where: { id: contentId },
        data:  { transcodeStatus: 'pending', transcodeError: null },
      });
    } catch {
      // Fallback: ORM fails if this DB hasn't run the transcodeStatus migration yet.
      await db.$executeRaw`UPDATE "Content" SET "transcodeStatus" = 'pending', "transcodeError" = NULL WHERE id = ${contentId}`;
    }

    // A transcode replaces the bytes that play on screens, so record who queued
    // it and which source it re-encodes from.
    await logAdminAction({
      actor, req,
      action: 'transcode_job.create',
      target: contentId,
      // Key deliberately not named *Key — admin-audit scrubs credential-shaped
      // field names, and /key/i would redact the object path into uselessness.
      meta:   { name: content.name, source: sourceKey },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
