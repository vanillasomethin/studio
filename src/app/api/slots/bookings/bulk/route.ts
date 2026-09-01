// Bulk slot booking — one request instead of hundreds of per-position clicks.
// POST /api/slots/bookings/bulk, two shapes:
//   { campaignId, storeIds[], from, to, daysOfWeek?, slotsPerDay }
//     — book a campaign into the lowest free positions across stores × dates.
//   { mode: 'copy-day', sourceStoreId, sourceDate, storeIds?, from, to, daysOfWeek? }
//     — replicate one store-day's position→campaign map onto other days/stores.
//
// Policy (deliberate): book what fits and report the gaps — partial availability
// must never block selling the rest of the network. Existing bookings by the same
// campaign count toward the target, so re-running a request is idempotent, and
// nothing is ever overwritten (unlike the single-assign upsert).
// Auth: admin-password header. Pushes plan_updated once, batched across stores.

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { istWeekday, isOpenOn } from '@/lib/slots';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const DAY_MS        = 86_400_000;
const MAX_STORES    = 100;
const MAX_RANGE_DAYS = 60;   // matches the availability grid cap
const MAX_PLANNED   = 5000;  // hard stop for a fat-fingered request, not a silent trim

type Body = {
  mode?: 'assign' | 'copy-day';
  campaignId?: string;
  storeIds?: string[];
  from?: string;
  to?: string;
  daysOfWeek?: number;      // Mon..Sun bitmask, default 127 (every day)
  slotsPerDay?: number;
  sourceStoreId?: string;
  sourceDate?: string;
};

type Gap          = { storeId: string; storeName: string; date: string; missed: number; reason: 'full' | 'partial' };
type SkippedStore = { storeId: string; storeName: string; reason: 'not-found' | 'not-slot-mode' };

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function expandDates(from: string, to: string, daysOfWeek: number): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (daysOfWeek & (1 << istWeekday(d))) out.push(d);
  }
  return out;
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as Body;
    const mode = body.mode === 'copy-day' ? 'copy-day' : 'assign';

    // ── Shared validation ────────────────────────────────────────────────────
    if (!isDate(body.from) || !isDate(body.to)) {
      return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 });
    }
    const rangeDays = (Date.parse(`${body.to}T00:00:00Z`) - Date.parse(`${body.from}T00:00:00Z`)) / DAY_MS + 1;
    if (rangeDays < 1) return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Date range too large — max ${MAX_RANGE_DAYS} days per request` }, { status: 400 });
    }
    const daysOfWeek = body.daysOfWeek ?? 127;
    if (!Number.isInteger(daysOfWeek) || daysOfWeek < 1 || daysOfWeek > 127) {
      return NextResponse.json({ error: 'daysOfWeek must be a non-empty Mon..Sun bitmask (1–127)' }, { status: 400 });
    }
    const dates = expandDates(body.from, body.to, daysOfWeek);
    if (dates.length === 0) return NextResponse.json({ error: 'No dates match the selected weekdays' }, { status: 400 });

    // ── Mode-specific validation + the position→campaign source ──────────────
    // 'assign' books slotsPerDay lowest-free positions per open day; 'copy-day'
    // books the exact positions of the source day. Both funnel into one planner.
    let campaignFor: (position: number) => string;          // campaign for a wanted position
    let wantedPositions: number[] | null = null;            // copy-day: exact source positions
    let requestedPerCell = 0;
    let targetStoreIds: string[];
    let auditTarget: string;
    let slotsPerDay = 0;
    let sourceRows: { slotPosition: number; campaignId: string }[] = [];

    if (mode === 'assign') {
      if (!body.campaignId || !Array.isArray(body.storeIds) || body.storeIds.length === 0) {
        return NextResponse.json({ error: 'campaignId and storeIds[] required' }, { status: 400 });
      }
      slotsPerDay = body.slotsPerDay ?? 0;
      if (!Number.isInteger(slotsPerDay) || slotsPerDay < 1 || slotsPerDay > 60) {
        return NextResponse.json({ error: 'slotsPerDay must be 1–60' }, { status: 400 });
      }
      const campaign = await db.campaign.findUnique({
        where: { id: body.campaignId }, select: { id: true, status: true },
      });
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.status === 'cancelled') {
        return NextResponse.json({ error: 'Campaign is cancelled — pick another' }, { status: 400 });
      }
      const cid = campaign.id;
      campaignFor = () => cid;
      requestedPerCell = slotsPerDay;
      targetStoreIds = [...new Set(body.storeIds)];
      auditTarget = cid;
    } else {
      if (!body.sourceStoreId || !isDate(body.sourceDate)) {
        return NextResponse.json({ error: 'sourceStoreId and sourceDate (YYYY-MM-DD) required' }, { status: 400 });
      }
      const source = await db.store.findUnique({
        where: { id: body.sourceStoreId }, select: { id: true, loopSlotCount: true },
      });
      if (!source) return NextResponse.json({ error: 'Source store not found' }, { status: 404 });
      if (source.loopSlotCount == null) {
        return NextResponse.json({ error: 'Source store is not in slot mode' }, { status: 400 });
      }
      sourceRows = await db.slotBooking.findMany({
        where:   {
          storeId: source.id, date: new Date(`${body.sourceDate}T00:00:00Z`),
          slotPosition: { lt: source.loopSlotCount },
          // The assign branch refuses cancelled campaigns; replicating them via
          // copy-day would resurrect a dead brand across a whole month.
          campaign: { status: { not: 'cancelled' } },
        },
        select:  { slotPosition: true, campaignId: true },
        orderBy: { slotPosition: 'asc' },
      });
      if (sourceRows.length === 0) {
        return NextResponse.json({ error: `Nothing to copy — ${body.sourceDate} has no bookings on that store` }, { status: 400 });
      }
      const byPos = new Map(sourceRows.map((r) => [r.slotPosition, r.campaignId]));
      campaignFor = (position) => byPos.get(position)!;
      requestedPerCell = sourceRows.length;
      targetStoreIds = [...new Set(body.storeIds?.length ? body.storeIds : [source.id])];
      auditTarget = `${source.id}:${body.sourceDate}`;
      wantedPositions = sourceRows.map((r) => r.slotPosition);
    }

    if (targetStoreIds.length > MAX_STORES) {
      return NextResponse.json({ error: `Too many stores — max ${MAX_STORES} per request` }, { status: 400 });
    }

    // ── Load the whole matrix in two queries, then plan in memory ────────────
    const stores = await db.store.findMany({
      where:  { id: { in: targetStoreIds } },
      select: { id: true, storeName: true, loopSlotCount: true, openDays: true },
    });
    const storeById = new Map(stores.map((s) => [s.id, s]));

    const skippedStores: SkippedStore[] = [];
    for (const id of targetStoreIds) {
      const s = storeById.get(id);
      if (!s) skippedStores.push({ storeId: id, storeName: id.slice(0, 8), reason: 'not-found' });
      else if (s.loopSlotCount == null) skippedStores.push({ storeId: id, storeName: s.storeName, reason: 'not-slot-mode' });
    }
    const slotStores = stores.filter((s) => s.loopSlotCount != null);
    if (slotStores.length === 0) {
      return NextResponse.json({ error: 'None of the selected stores are in slot mode', skippedStores }, { status: 400 });
    }

    const existing = await db.slotBooking.findMany({
      where: {
        storeId: { in: slotStores.map((s) => s.id) },
        // IN on the exact planning dates, not gte/lte: a "Mondays only" request
        // over 60 days must not drag every booking of the whole range from Neon.
        date:    { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) },
      },
      select: { storeId: true, date: true, slotPosition: true, campaignId: true },
    });
    const takenByCell = new Map<string, Map<number, string>>(); // storeId|date → position → campaignId
    for (const b of existing) {
      const key = `${b.storeId}|${b.date.toISOString().slice(0, 10)}`;
      const cell = takenByCell.get(key) ?? new Map<number, string>();
      cell.set(b.slotPosition, b.campaignId);
      takenByCell.set(key, cell);
    }

    const rows: { storeId: string; date: Date; slotPosition: number; campaignId: string }[] = [];
    const gaps: Gap[] = [];
    let requested = 0, alreadySatisfied = 0, closedSkipped = 0;

    for (const store of slotStores) {
      const loopSlotCount = store.loopSlotCount!;
      for (const date of dates) {
        if (mode === 'copy-day' && store.id === body.sourceStoreId && date === body.sourceDate) continue;
        if (!isOpenOn(store.openDays, date)) { closedSkipped++; continue; }
        requested += requestedPerCell;

        const taken = takenByCell.get(`${store.id}|${date}`) ?? new Map<number, string>();
        let bookedHere = 0, missedHere = 0;

        if (wantedPositions) {
          // copy-day: exact positions. Same campaign already there = satisfied;
          // anyone else holding the position = missed (never overwrite a sale).
          for (const pos of wantedPositions) {
            const campaignId = campaignFor(pos);
            if (pos >= loopSlotCount) { missedHere++; continue; }
            const holder = taken.get(pos);
            if (holder === campaignId) { alreadySatisfied++; continue; }
            if (holder !== undefined)  { missedHere++; continue; }
            rows.push({ storeId: store.id, date: new Date(`${date}T00:00:00Z`), slotPosition: pos, campaignId });
            bookedHere++;
          }
        } else {
          // assign: existing bookings by this campaign count toward the daily target.
          const campaignId = campaignFor(0);
          let mine = 0;
          for (const [pos, holder] of taken) {
            if (holder === campaignId && pos < loopSlotCount) mine++;
          }
          const already = Math.min(mine, slotsPerDay);
          alreadySatisfied += already;
          let want = slotsPerDay - already;
          for (let pos = 0; pos < loopSlotCount && want > 0; pos++) {
            if (taken.has(pos)) continue;
            rows.push({ storeId: store.id, date: new Date(`${date}T00:00:00Z`), slotPosition: pos, campaignId });
            bookedHere++;
            want--;
          }
          missedHere = want;
        }

        if (missedHere > 0) {
          gaps.push({
            storeId: store.id, storeName: store.storeName, date,
            missed: missedHere, reason: bookedHere === 0 ? 'full' : 'partial',
          });
        }
      }
    }

    if (rows.length > MAX_PLANNED) {
      return NextResponse.json({
        error: `This would create ${rows.length} bookings (max ${MAX_PLANNED} per request) — narrow the date range or store list`,
      }, { status: 400 });
    }

    // skipDuplicates: the (storeId, date, slotPosition) unique constraint absorbs a
    // concurrent admin racing us for the same position — their booking survives, ours
    // is dropped, and the count difference is reported instead of anyone's sale being
    // silently replaced.
    const result = rows.length > 0
      ? await db.slotBooking.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };
    const raced = rows.length - result.count;

    // One nudge for the whole batch — the whole point of BUG-07's lesson: a bulk
    // write that never tells the players is a booking that airs a day late. Inside
    // after(), not a floating chain: the instance can suspend at response flush,
    // and the next scheduled plan poll is 72 h out.
    const affectedStoreIds = [...new Set(rows.map((r) => r.storeId))];
    if (affectedStoreIds.length > 0) {
      after(async () => {
        try {
          const devices = await db.device.findMany({
            where: { storeId: { in: affectedStoreIds } }, select: { id: true },
          });
          await pushPlanUpdated(devices.map((d) => d.id));
        } catch { /* best-effort — the poll is the fallback */ }
      });
    }

    const missed = gaps.reduce((n, g) => n + g.missed, 0);
    await logAdminAction({
      actor, req,
      action: 'slot_booking.bulk_assign',
      target: auditTarget,
      meta: {
        mode, from: body.from, to: body.to, daysOfWeek,
        ...(mode === 'assign' ? { campaignId: body.campaignId, slotsPerDay } : { sourceStoreId: body.sourceStoreId, sourceDate: body.sourceDate }),
        stores: slotStores.length, requested, alreadySatisfied,
        planned: rows.length, booked: result.count, raced, missed, closedSkipped,
      },
    });

    // Cap the gap detail, never the truth: the aggregate `missed` above is exact.
    const gapsTruncated = gaps.length > 500;
    return NextResponse.json({
      booked:  result.count,
      planned: rows.length,
      requested,
      alreadySatisfied,
      raced,
      missed,
      gaps: gapsTruncated ? gaps.slice(0, 500) : gaps,
      gapsTruncated,
      skippedStores,
      closedSkipped,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
