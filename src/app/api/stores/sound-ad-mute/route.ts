// GET  /api/stores/sound-ad-mute?storeId=…        — current mute state
// PATCH /api/stores/sound-ad-mute { storeId, muted } — store owner override
// Auth: store-partner pattern — resolveStoreId, never auth()-gated (see CLAUDE.md).
//
// Sound Ad plays once/hour with audio on; muting forces it silent like every other
// slot, with no refund logic (spec). Read by /api/device/plan into the plan's
// top-level soundAdMuted flag.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { soundAdMuted: true } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  return NextResponse.json({ muted: store.soundAdMuted });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { storeId?: string; muted?: boolean } | null;
  const storeId = await resolveStoreId(body?.storeId ?? null);
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (typeof body?.muted !== 'boolean') return NextResponse.json({ error: 'muted must be a boolean' }, { status: 400 });

  await db.store.update({ where: { id: storeId }, data: { soundAdMuted: body.muted } });
  return NextResponse.json({ muted: body.muted });
}
