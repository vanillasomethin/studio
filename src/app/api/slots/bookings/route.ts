// Slot booking CRUD for the admin grid.
// GET    /api/slots/bookings?storeId&date → per-position rows + the computed playable
//        loop (filler/bonus redistribution included) so the admin sees what will play.
// POST   /api/slots/bookings   { storeId, date, slotPosition, campaignId } — assign
//        (upsert: reassigning an already-sold position replaces the campaign).
// DELETE /api/slots/bookings?id — unassign (row delete; the position simply becomes
//        empty and rejoins filler redistribution).
// Auth: admin-password header. Mutations push plan_updated to the store's devices.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSlotLoop, slotCreativeIds, slotDayIndex } from '@/lib/slots';
import { resolveFillerCampaign } from '@/lib/slots-db';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

async function pushStoreDevices(storeId: string) {
  const devices = await db.device.findMany({ where: { storeId }, select: { id: true } });
  await pushPlanUpdated(devices.map((d) => d.id));
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const storeId = req.nextUrl.searchParams.get('storeId') ?? '';
    const date    = req.nextUrl.searchParams.get('date') ?? '';
    if (!storeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'storeId and date=YYYY-MM-DD required' }, { status: 400 });
    }
    const store = await db.store.findUnique({
      where:  { id: storeId },
      select: { loopSlotCount: true, fillerCampaignId: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.loopSlotCount == null) return NextResponse.json({ error: 'Store is not in slot mode' }, { status: 400 });

    const bookings = await db.slotBooking.findMany({
      where:   { storeId, date: new Date(`${date}T00:00:00Z`) },
      include: { campaign: { select: {
        id: true, name: true, slotContentId: true,
        slotPlaylist: { select: { items: {
          where: { contentId: { not: null } }, orderBy: { order: 'asc' }, select: { contentId: true },
        } } },
      } } },
      orderBy: { slotPosition: 'asc' },
    });

    const filler = await resolveFillerCampaign(store.fillerCampaignId);
    const loop = buildSlotLoop(
      store.loopSlotCount,
      bookings.map((b) => ({ slotPosition: b.slotPosition, campaignId: b.campaignId, creativeIds: slotCreativeIds(b.campaign) })),
      filler,
      slotDayIndex(date),
    );

    return NextResponse.json({
      loopSlotCount: store.loopSlotCount,
      bookings: bookings.map((b) => {
        const creativeCount = slotCreativeIds(b.campaign).length;
        return {
          id: b.id, slotPosition: b.slotPosition,
          campaignId: b.campaignId, campaignName: b.campaign.name,
          hasCreative: creativeCount > 0,
          // >1 = a slot playlist rotates through this many creatives day by day.
          creativeCount,
        };
      }),
      // What actually plays, per position — bonus/filler entries carry isFiller=true.
      playableLoop: loop,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { storeId, date, slotPosition, campaignId } = await req.json() as {
      storeId: string; date: string; slotPosition: number; campaignId: string;
    };
    if (!storeId || !campaignId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isInteger(slotPosition)) {
      return NextResponse.json({ error: 'storeId, date (YYYY-MM-DD), slotPosition, campaignId required' }, { status: 400 });
    }
    const store = await db.store.findUnique({ where: { id: storeId }, select: { loopSlotCount: true } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.loopSlotCount == null) return NextResponse.json({ error: 'Store is not in slot mode' }, { status: 400 });
    if (slotPosition < 0 || slotPosition >= store.loopSlotCount) {
      return NextResponse.json({ error: `slotPosition must be 0–${store.loopSlotCount - 1}` }, { status: 400 });
    }
    // Same guard as the bulk route: a cancelled campaign must not be resurrected
    // onto a screen, and a typo'd id deserves a 404, not a raw FK 500.
    const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'cancelled') {
      return NextResponse.json({ error: 'Campaign is cancelled — pick another' }, { status: 400 });
    }

    const booking = await db.slotBooking.upsert({
      where:  { storeId_date_slotPosition: { storeId, date: new Date(`${date}T00:00:00Z`), slotPosition } },
      update: { campaignId },
      create: { storeId, date: new Date(`${date}T00:00:00Z`), slotPosition, campaignId },
    });

    pushStoreDevices(storeId).catch(() => {});

    // Selling a loop position is what puts a brand's creative on a screen — and an
    // upsert silently replaces whoever held the position before. Record who did it.
    await logAdminAction({
      actor, req,
      action: 'slot_booking.assign',
      target: booking.id,
      meta:   { storeId, date, slotPosition, campaignId },
    });

    return NextResponse.json({ booking });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const booking = await db.slotBooking.delete({
      where:  { id },
      select: { storeId: true, date: true, slotPosition: true, campaignId: true },
    });
    pushStoreDevices(booking.storeId).catch(() => {});

    // The row is gone, so the audit note is the only remaining record of which
    // brand lost which position on which day.
    await logAdminAction({
      actor, req,
      action: 'slot_booking.unassign',
      target: id,
      meta: {
        storeId:      booking.storeId,
        date:         booking.date.toISOString().slice(0, 10),
        slotPosition: booking.slotPosition,
        campaignId:   booking.campaignId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
