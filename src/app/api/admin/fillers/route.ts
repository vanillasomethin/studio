// House filler creatives — ALIVE's own content for unsold loop positions.
//
//   GET    /api/admin/fillers                                 → list
//   POST   /api/admin/fillers { name, contentId?, playlistId? } → create
//   PATCH  /api/admin/fillers { id, ...fields }                → rename / repoint / activate
//   DELETE /api/admin/fillers?id=…                             → remove
//
// These are deliberately not Campaigns: a campaign is something a brand bought
// and is billed for, and modelling filler as one put house content into the
// campaigns list, the booking picker and revenue reports. See the FillerCreative
// model comment.
//
// Auth: named admin session.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { db } from '@/lib/db';

type Body = {
  id?: string;
  name?: string;
  contentId?: string | null;
  playlistId?: string | null;
  active?: boolean;
};

/** Content and playlist are alternatives, not a pair — a filler that had both
 *  would silently ignore one, so the API refuses rather than picking. */
function bothSet(b: Body): boolean {
  return !!b.contentId && !!b.playlistId;
}

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const [fillers, config] = await Promise.all([
    db.fillerCreative.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, active: true, createdAt: true,
        contentId: true, playlistId: true,
        content:  { select: { id: true, name: true, type: true, durationMs: true, objectKey: true } },
        playlist: { select: { id: true, name: true, _count: { select: { items: true } } } },
        _count:   { select: { forStores: true } },
      },
    }),
    db.playerConfig.findUnique({ where: { id: 1 }, select: { fillerCreativeId: true } }),
  ]);

  return NextResponse.json({
    fillers: fillers.map((f) => ({
      id: f.id,
      name: f.name,
      active: f.active,
      createdAt: f.createdAt.toISOString(),
      contentId: f.contentId,
      playlistId: f.playlistId,
      content: f.content,
      playlist: f.playlist ? { id: f.playlist.id, name: f.playlist.name, itemCount: f.playlist._count.items } : null,
      /** Stores that override the fleet default with this one. */
      storeCount: f._count.forStores,
      isDefault: config?.fillerCreativeId === f.id,
    })),
    defaultFillerId: config?.fillerCreativeId ?? null,
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as Body | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (body && bothSet(body)) {
    return NextResponse.json({ error: 'Give a single creative or a playlist, not both' }, { status: 400 });
  }

  const filler = await db.fillerCreative.create({
    data: {
      name,
      contentId:  body?.contentId  || null,
      playlistId: body?.playlistId || null,
    },
    select: { id: true, name: true },
  });

  await logAdminAction({
    actor, req, action: 'filler.create', target: filler.id,
    meta: { name, contentId: body?.contentId ?? null, playlistId: body?.playlistId ?? null },
  });
  return NextResponse.json({ filler });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as Body | null;
  const id = body?.id?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (body && bothSet(body)) {
    return NextResponse.json({ error: 'Give a single creative or a playlist, not both' }, { status: 400 });
  }

  // Setting one clears the other, so a filler never carries a stale pointer that
  // would come back if the active one were later removed.
  const data: Record<string, unknown> = {};
  if (body?.name !== undefined)   data.name = body.name.trim();
  if (body?.active !== undefined) data.active = body.active;
  if (body?.contentId !== undefined)  { data.contentId  = body.contentId  || null; if (body.contentId)  data.playlistId = null; }
  if (body?.playlistId !== undefined) { data.playlistId = body.playlistId || null; if (body.playlistId) data.contentId  = null; }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const filler = await db.fillerCreative.update({
    where: { id },
    data,
    select: { id: true, name: true, active: true, contentId: true, playlistId: true },
  });

  await logAdminAction({ actor, req, action: 'filler.update', target: id, meta: data });
  return NextResponse.json({ filler });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Deleting the fleet default would leave every slot-mode store with no filler
  // and unsold positions going dark, which is the one outcome the loop exists to
  // prevent. Make it an explicit two-step: clear the default first.
  const config = await db.playerConfig.findUnique({ where: { id: 1 }, select: { fillerCreativeId: true } });
  if (config?.fillerCreativeId === id) {
    return NextResponse.json(
      { error: 'This is the fleet default filler. Pick a different default before deleting it.' },
      { status: 409 },
    );
  }

  // Store.fillerCreativeId is ON DELETE SET NULL, so any store overriding with
  // this one falls back to the fleet default rather than losing its filler.
  await db.fillerCreative.delete({ where: { id } });
  await logAdminAction({ actor, req, action: 'filler.delete', target: id });
  return NextResponse.json({ ok: true });
}
