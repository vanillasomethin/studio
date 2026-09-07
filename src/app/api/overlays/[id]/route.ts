// PATCH /api/overlays/[id] — update an overlay
// DELETE /api/overlays/[id] — delete an overlay

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const body = await req.json() as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const passthrough = ['name', 'type', 'enabled', 'text', 'feedUrl', 'imageUrl', 'position',
      'bgColor', 'fgColor', 'speedPxSec', 'heightPct', 'deviceIds', 'groupName', 'storeIds',
      'cityFilter', 'dailyStart', 'dailyEnd', 'requireWifi', 'priority'];
    for (const k of passthrough) if (body[k] !== undefined) data[k] = body[k];
    if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt as string) : null;
    if (body.endAt   !== undefined) data.endAt   = body.endAt   ? new Date(body.endAt   as string) : null;

    const overlay = await db.overlay.update({ where: { id }, data });

    // An overlay is burned over whatever is playing on a screen, so an edit can
    // change what a shopper reads without touching a playlist. Record the fields
    // that moved — not their values, which can be arbitrary free text.
    await logAdminAction({
      actor, req,
      action: 'overlay.update',
      target: id,
      meta: {
        fields:  Object.keys(data),
        name:    overlay.name,
        type:    overlay.type,
        enabled: overlay.enabled,
      },
    });

    return NextResponse.json({
      overlay: {
        ...overlay,
        startAt:       overlay.startAt?.toISOString()       ?? null,
        endAt:         overlay.endAt?.toISOString()         ?? null,
        feedFetchedAt: overlay.feedFetchedAt?.toISOString() ?? null,
        createdAt:     overlay.createdAt.toISOString(),
        updatedAt:     overlay.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    // delete() returns the row it removed — the only chance to record what the
    // overlay actually was, since after this the id resolves to nothing.
    const overlay = await db.overlay.delete({ where: { id } });
    await logAdminAction({
      actor, req,
      action: 'overlay.delete',
      target: id,
      meta:   { name: overlay.name, type: overlay.type },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
