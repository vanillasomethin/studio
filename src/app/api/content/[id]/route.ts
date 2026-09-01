// DELETE /api/content/[id]  — remove from DB and R2
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteObject } from '@/lib/r2';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const content = await db.content.findUnique({ where: { id } });
    if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.content.delete({ where: { id } });
    // Best-effort R2 delete — current rendition, preserved original, HEVC rendition.
    await deleteObject(content.objectKey).catch(() => {});
    if (content.originalObjectKey && content.originalObjectKey !== content.objectKey) {
      await deleteObject(content.originalObjectKey).catch(() => {});
    }
    if (content.hevcObjectKey) await deleteObject(content.hevcObjectKey).catch(() => {});

    // Media leaving the library is irreversible (the R2 objects go with it), so
    // record what was removed alongside who removed it.
    await logAdminAction({
      actor, req,
      action: 'content.delete',
      target: id,
      // `object`, not `objectKey`: the audit scrubber redacts any key whose words
      // include "key", so naming it objectKey would store "[redacted]" — losing
      // the R2 path, which is the only thing identifying the destroyed file.
      meta:   { name: content.name, object: content.objectKey },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
