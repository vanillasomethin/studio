import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { getTuyaDevice, getTuyaScales, isTuyaConfigured } from '@/lib/tuya';
import { recordPlugPoll } from '@/lib/tuya-power';

// Link / unlink a Tuya (Aziot) smart plug to a store. Linking fetches the
// device's live detail and value scales up front, writes the SmartPlug row and
// records the first reading — so the panel shows real numbers immediately, not
// after the next cron pass.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id: storeId } = await params;

  if (!isTuyaConfigured()) {
    return NextResponse.json({ error: 'Tuya cloud project is not configured (TUYA_CLIENT_ID / TUYA_CLIENT_SECRET).' }, { status: 409 });
  }

  const body = await req.json().catch(() => null) as { tuyaDeviceId?: unknown } | null;
  const tuyaDeviceId = typeof body?.tuyaDeviceId === 'string' ? body.tuyaDeviceId.trim() : '';
  if (!tuyaDeviceId) {
    return NextResponse.json({ error: 'tuyaDeviceId is required.' }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, storeName: true } });
  if (!store) return NextResponse.json({ error: 'Store not found.' }, { status: 404 });

  // One plug per device: stealing a plug that meters another store must be an
  // explicit unlink there first, not a silent re-point here.
  const taken = await db.smartPlug.findUnique({
    where: { tuyaDeviceId },
    select: { storeId: true, store: { select: { storeName: true } } },
  });
  if (taken && taken.storeId !== storeId) {
    return NextResponse.json(
      { error: `This plug is already linked to ${taken.store.storeName}. Unlink it there first.` },
      { status: 409 },
    );
  }

  let device;
  try {
    device = await getTuyaDevice(tuyaDeviceId);
  } catch (e) {
    return NextResponse.json({ error: `Tuya does not know this device: ${(e as Error).message}` }, { status: 502 });
  }
  const scales = await getTuyaScales(tuyaDeviceId);

  const plug = await db.smartPlug.upsert({
    where: { storeId },
    update: { tuyaDeviceId, name: device.name, productName: device.product_name ?? null, category: device.category ?? null, scales },
    create: { storeId, tuyaDeviceId, name: device.name, productName: device.product_name ?? null, category: device.category ?? null, scales },
  });
  // A lost claim here means a poll landed between upsert and now — its data is
  // just as fresh, so fall back to the row it wrote.
  const polled = (await recordPlugPoll(plug, { online: !!device.online, status: device.status }))
    ?? (await db.smartPlug.findUnique({ where: { id: plug.id } }))
    ?? plug;

  await logAdminAction({ actor, action: 'store.plug.link', target: storeId, meta: { tuyaDeviceId, deviceName: device.name }, req });
  return NextResponse.json({
    ok: true,
    plug: {
      tuyaDeviceId: polled.tuyaDeviceId,
      name: polled.name,
      online: polled.online,
      powerW: polled.powerW,
      lastPolledAt: polled.lastPolledAt?.toISOString() ?? null,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id: storeId } = await params;

  // Readings cascade with the plug row: an unlink is "this store is no longer
  // metered", and half-history for an unlinked plug only misleads.
  const plug = await db.smartPlug.findUnique({ where: { storeId }, select: { id: true, tuyaDeviceId: true } });
  if (!plug) return NextResponse.json({ error: 'No plug linked to this store.' }, { status: 404 });

  await db.smartPlug.delete({ where: { id: plug.id } });
  await logAdminAction({ actor, action: 'store.plug.unlink', target: storeId, meta: { tuyaDeviceId: plug.tuyaDeviceId }, req });
  return NextResponse.json({ ok: true });
}
