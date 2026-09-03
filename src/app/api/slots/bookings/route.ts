// Slot booking CRUD for the admin grid.
// GET    /api/slots/bookings?storeId&date → per-position rows + the computed playable
//        loop (filler/bonus redistribution included) so the admin sees what will play.
// POST   /api/slots/bookings   { storeId, date, slotPosition, campaignId } — assign.
//        A single-slot campaign upserts (reassigning a sold position replaces the
//        campaign, as before). A multi-slot campaign books slotPosition..+span-1 as
//        one placement and requires every covered position to be free — replacing
//        would silently evict more than the one position the admin clicked.
// DELETE /api/slots/bookings?id — unassign. Deleting any member of a multi-slot
//        placement removes the whole placement (a 30s window missing its middle
//        10s is not a thing anyone can buy).
// Auth: admin session. Mutations push plan_updated to the store's devices.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { buildSlotLoop, slotDayIndex, slotSpanForDuration, uniformSlotSpan, SlotCreativeMeta } from '@/lib/slots';
import { resolveFillerCampaign } from '@/lib/slots-db';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

async function pushStoreDevices(storeId: string) {
  const devices = await db.device.findMany({ where: { storeId }, select: { id: true } });
  await pushPlanUpdated(devices.map((d) => d.id));
}

// Shared campaign-creative select: ids + durations, so the span can be derived.
const CAMPAIGN_CREATIVES_SELECT = {
  id: true, name: true, status: true, slotContentId: true,
  slotContent: { select: { id: true, durationMs: true, type: true } },
  slotPlaylist: { select: { items: {
    where: { contentId: { not: null } }, orderBy: { order: 'asc' as const },
    select: { content: { select: { id: true, durationMs: true, type: true } } },
  } } },
} satisfies Prisma.CampaignSelect;

type CampaignWithCreatives = Prisma.CampaignGetPayload<{ select: typeof CAMPAIGN_CREATIVES_SELECT }>;

function campaignCreatives(c: CampaignWithCreatives): SlotCreativeMeta[] {
  const fromPlaylist = (c.slotPlaylist?.items ?? [])
    .map((i) => i.content)
    .filter((x): x is NonNullable<typeof x> => x != null)
    .map((x) => ({ contentId: x.id, durationMs: x.durationMs, type: x.type }));
  if (fromPlaylist.length > 0) return fromPlaylist;
  return c.slotContent ? [{ contentId: c.slotContent.id, durationMs: c.slotContent.durationMs, type: c.slotContent.type }] : [];
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
      include: { campaign: { select: CAMPAIGN_CREATIVES_SELECT } },
      orderBy: { slotPosition: 'asc' },
    });

    const filler = await resolveFillerCampaign(store.fillerCampaignId);
    const loop = buildSlotLoop(
      store.loopSlotCount,
      bookings.map((b) => {
        const creatives = campaignCreatives(b.campaign);
        return {
          slotPosition: b.slotPosition,
          campaignId:   b.campaignId,
          creativeIds:  creatives.map((c) => c.contentId),
          spanId:       b.spanId,
          creativeSpan: creatives.length ? Math.max(...creatives.map((c) => slotSpanForDuration(c.durationMs))) : 1,
        };
      }),
      filler,
      slotDayIndex(date),
    );

    // Span metadata per row so the grid can render merged windows: every row of a
    // placement reports the group size and whether it is the head (lowest position).
    const spanSizes = new Map<string, number>();
    const spanHeads = new Map<string, number>();
    for (const b of bookings) {
      if (!b.spanId) continue;
      spanSizes.set(b.spanId, (spanSizes.get(b.spanId) ?? 0) + 1);
      spanHeads.set(b.spanId, Math.min(spanHeads.get(b.spanId) ?? Infinity, b.slotPosition));
    }

    return NextResponse.json({
      loopSlotCount: store.loopSlotCount,
      bookings: bookings.map((b) => {
        const creatives = campaignCreatives(b.campaign);
        return {
          id: b.id, slotPosition: b.slotPosition,
          campaignId: b.campaignId, campaignName: b.campaign.name,
          hasCreative: creatives.length > 0,
          // >1 = a slot playlist rotates through this many creatives day by day.
          creativeCount: creatives.length,
          spanId:     b.spanId,
          spanSlots:  b.spanId ? (spanSizes.get(b.spanId) ?? 1) : 1,
          isSpanHead: b.spanId ? spanHeads.get(b.spanId) === b.slotPosition : true,
        };
      }),
      // What actually plays, per position — bonus/filler entries carry isFiller=true,
      // multi-slot placements appear once at their head with spanSlots > 1.
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
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }, select: CAMPAIGN_CREATIVES_SELECT,
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'cancelled') {
      return NextResponse.json({ error: 'Campaign is cancelled — pick another' }, { status: 400 });
    }
    const spanned = uniformSlotSpan(campaignCreatives(campaign));
    if ('error' in spanned) return NextResponse.json({ error: spanned.error }, { status: 400 });
    const span = spanned.span;
    const dateObj = new Date(`${date}T00:00:00Z`);

    if (span === 1) {
      // A position inside someone's multi-slot window cannot be replaced one 10s
      // chunk at a time — the admin would be evicting a 30s ad they cannot see
      // from this cell. The guard must hold AT WRITE TIME, not in a prior read: a
      // plain upsert here raced a concurrent multi-slot createMany and silently
      // overwrote one member row of the new placement (keeping its spanId, so the
      // hijacked sale never aired and a later unassign destroyed the whole rival
      // window). updateMany filtered on spanId:null converts that interleaving
      // into a clean 409 instead.
      const replaced = await db.slotBooking.updateMany({
        where: { storeId, date: dateObj, slotPosition, spanId: null },
        data:  { campaignId },
      });
      let booking = null;
      if (replaced.count === 1) {
        booking = await db.slotBooking.findUnique({
          where: { storeId_date_slotPosition: { storeId, date: dateObj, slotPosition } },
        });
      }
      if (!booking) {
        try {
          booking = await db.slotBooking.create({
            data: { storeId, date: dateObj, slotPosition, campaignId },
          });
        } catch (e) {
          // Row exists but didn't match spanId:null — it is (or just became) part
          // of a multi-slot window.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return NextResponse.json({
              error: 'This position is part of a multi-slot booking — unassign that booking first',
            }, { status: 409 });
          }
          throw e;
        }
      }

      pushStoreDevices(storeId).catch(() => {});
      await logAdminAction({
        actor, req,
        action: 'slot_booking.assign',
        target: booking.id,
        meta:   { storeId, date, slotPosition, campaignId },
      });
      return NextResponse.json({ booking, spanSlots: 1 });
    }

    // Multi-slot: the placement occupies slotPosition..slotPosition+span-1.
    if (slotPosition + span > store.loopSlotCount) {
      return NextResponse.json({
        error: `This ad needs ${span} consecutive slots (${span * 10}s) — it does not fit starting at position ${slotPosition} in a ${store.loopSlotCount}-slot loop`,
      }, { status: 400 });
    }
    const positions = Array.from({ length: span }, (_, i) => slotPosition + i);
    const blockers = await db.slotBooking.findMany({
      where:  { storeId, date: dateObj, slotPosition: { in: positions } },
      select: { slotPosition: true, campaign: { select: { name: true } } },
      orderBy: { slotPosition: 'asc' },
    });
    if (blockers.length > 0) {
      const held = blockers.map((b) => `${b.slotPosition} (${b.campaign.name})`).join(', ');
      return NextResponse.json({
        error: `Needs positions ${slotPosition}–${slotPosition + span - 1} free — held: ${held}`,
      }, { status: 409 });
    }

    const spanId = randomUUID();
    try {
      await db.slotBooking.createMany({
        data: positions.map((pos) => ({ storeId, date: dateObj, slotPosition: pos, campaignId, spanId })),
      });
    } catch (e) {
      // The unique constraint fired: someone raced us onto a covered position after
      // the check above. createMany is a single statement, so nothing partial exists.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'A covered position was just taken — reload the grid' }, { status: 409 });
      }
      throw e;
    }
    const head = await db.slotBooking.findUnique({
      where: { storeId_date_slotPosition: { storeId, date: dateObj, slotPosition } },
    });

    pushStoreDevices(storeId).catch(() => {});
    await logAdminAction({
      actor, req,
      action: 'slot_booking.assign',
      target: head?.id ?? spanId,
      meta:   { storeId, date, slotPosition, campaignId, spanId, spanSlots: span },
    });
    return NextResponse.json({ booking: head, spanId, spanSlots: span });
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
    const row = await db.slotBooking.findUnique({
      where:  { id },
      select: { storeId: true, date: true, slotPosition: true, campaignId: true, spanId: true },
    });
    if (!row) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // A multi-slot placement is one sale: removing any member removes the window.
    // Capture the sibling positions first — after the delete, the audit row is
    // the only record of WHICH positions the brand lost.
    const groupPositions = row.spanId
      ? (await db.slotBooking.findMany({
          where: { spanId: row.spanId }, select: { slotPosition: true }, orderBy: { slotPosition: 'asc' },
        })).map((r) => r.slotPosition)
      : [row.slotPosition];
    const removed = row.spanId
      ? await db.slotBooking.deleteMany({ where: { spanId: row.spanId } })
      : await db.slotBooking.deleteMany({ where: { id } });

    pushStoreDevices(row.storeId).catch(() => {});

    // The rows are gone, so the audit note is the only remaining record of which
    // brand lost which position(s) on which day.
    await logAdminAction({
      actor, req,
      action: 'slot_booking.unassign',
      target: id,
      meta: {
        storeId:      row.storeId,
        date:         row.date.toISOString().slice(0, 10),
        slotPosition: row.slotPosition,
        campaignId:   row.campaignId,
        ...(row.spanId ? { spanId: row.spanId, removedRows: removed.count, positions: groupPositions } : {}),
      },
    });

    return NextResponse.json({ ok: true, removed: removed.count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
