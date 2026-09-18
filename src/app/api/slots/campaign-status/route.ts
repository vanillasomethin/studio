// GET /api/slots/campaign-status            → { summaries: { [campaignId]: CampaignSlotSummary } }
// GET /api/slots/campaign-status?campaignId= → the same summary plus today's store list
//
// "Where is this campaign playing right now?" — the question ops asks before booking
// anything, and the one the slot grid could not answer because it is indexed by store
// and date, never by campaign. Today's rows are what is ON AIR (the loop for an IST
// date is built from that date's bookings); rows dated later are what is SOLD ahead.
//
// Counts are slot ROWS, not plays: a 30s ad holding one window reports 3. That is the
// inventory number — what the brand occupies of the store's loop — and it matches the
// sold/total the availability grid shows, so the two never disagree on screen.
//
// Auth: admin session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { istToday } from '@/lib/slots';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const campaignId = req.nextUrl.searchParams.get('campaignId');
    const today    = istToday();
    const todayObj = new Date(`${today}T00:00:00Z`);
    const scope = campaignId ? { campaignId } : {};

    // Two grouped reads over the same future window: one keyed by campaign+store
    // (distinct stores, which a plain count cannot give), one keyed by campaign
    // (the date span). Both are indexed by the SlotBooking (storeId, date) key.
    const byStore = await db.slotBooking.groupBy({
      by: ['campaignId', 'storeId', 'date'],
      where: { ...scope, date: { gte: todayObj } },
      _count: { id: true },
    });
    const spans = await db.slotBooking.groupBy({
      by: ['campaignId'],
      where: { ...scope, date: { gte: todayObj } },
      _min: { date: true },
      _max: { date: true },
    });

    type Acc = {
      storesToday: Set<string>; slotsToday: number;
      storesUpcoming: Set<string>; slotsUpcoming: number;
    };
    const acc = new Map<string, Acc>();
    for (const row of byStore) {
      const a = acc.get(row.campaignId) ?? {
        storesToday: new Set<string>(), slotsToday: 0,
        storesUpcoming: new Set<string>(), slotsUpcoming: 0,
      };
      const isToday = row.date.toISOString().slice(0, 10) === today;
      if (isToday) { a.storesToday.add(row.storeId); a.slotsToday += row._count.id; }
      else         { a.storesUpcoming.add(row.storeId); a.slotsUpcoming += row._count.id; }
      acc.set(row.campaignId, a);
    }

    const spanById = new Map(spans.map((s) => [s.campaignId, s]));
    const summaries: Record<string, {
      onAir: boolean;
      storesToday: number; slotsToday: number;
      storesUpcoming: number; slotsUpcoming: number;
      firstDate: string | null; lastDate: string | null;
    }> = {};
    for (const [id, a] of acc) {
      const span = spanById.get(id);
      summaries[id] = {
        onAir: a.slotsToday > 0,
        storesToday: a.storesToday.size,
        slotsToday:  a.slotsToday,
        // Stores booked on a LATER date, whether or not they also run today — the
        // question is "who is coming up", and excluding today's stores would answer
        // a different one.
        storesUpcoming: a.storesUpcoming.size,
        slotsUpcoming:  a.slotsUpcoming,
        firstDate: span?._min.date?.toISOString().slice(0, 10) ?? null,
        lastDate:  span?._max.date?.toISOString().slice(0, 10) ?? null,
      };
    }

    if (!campaignId) return NextResponse.json({ today, summaries });

    // Detail view: which stores are playing it today, named — an id tells ops nothing.
    const rows = await db.slotBooking.findMany({
      where:   { campaignId, date: todayObj },
      select:  { slotPosition: true, store: { select: { id: true, storeName: true, locality: true, city: true, slotPricingTier: true, loopSlotCount: true } } },
      orderBy: { slotPosition: 'asc' },
    });
    const playingById = new Map<string, { store: (typeof rows)[number]['store']; positions: number[] }>();
    for (const r of rows) {
      const entry = playingById.get(r.store.id) ?? { store: r.store, positions: [] };
      entry.positions.push(r.slotPosition);
      playingById.set(r.store.id, entry);
    }

    return NextResponse.json({
      today,
      summary: summaries[campaignId] ?? {
        onAir: false, storesToday: 0, slotsToday: 0,
        storesUpcoming: 0, slotsUpcoming: 0, firstDate: null, lastDate: null,
      },
      playingToday: [...playingById.values()].map((e) => ({
        storeId:   e.store.id,
        storeName: e.store.storeName,
        locality:  e.store.locality,
        city:      e.store.city,
        tier:      e.store.slotPricingTier,
        loopSlotCount: e.store.loopSlotCount,
        // 1-based for display — the grid and the loop panel both number slots from 1.
        slots: e.positions.map((p) => p + 1),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
