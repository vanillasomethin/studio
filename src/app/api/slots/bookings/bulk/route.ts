// Bulk slot booking — one request instead of hundreds of per-position clicks.
// POST /api/slots/bookings/bulk, two shapes:
//   { campaignId, storeIds[], from, to, daysOfWeek?, slotsPerDay }
//     — book a campaign into the lowest free positions across stores × dates.
//       slotsPerDay counts PLAYS per day: a multi-slot ad (30s = 3 slots) books
//       that many consecutive positions per play, so 2 plays of a 30s ad take 6.
//   { campaignId, storeIds[], from, to, daysOfWeek?, positions[] }
//     — the same, but the caller names the loop positions (0-based) instead of
//       letting the planner pick. Each position is the HEAD of one play, so a 30s
//       ad asked for position 4 takes 4,5,6; a run that isn't wholly free is
//       reported as a gap, never overwritten. slotsPerDay is implied by the count.
//   { mode: 'copy-day', sourceStoreId, sourceDate, storeIds?, from, to, daysOfWeek? }
//     — replicate one store-day's position→campaign map onto other days/stores.
//       Multi-slot placements copy as whole windows or not at all.
//
// Policy (deliberate): book what fits and report the gaps — partial availability
// must never block selling the rest of the network. The one exception is a request
// that lands NOTHING at all and was not already satisfied: that comes back 409 so
// the operator is told to review the booking rather than reading "booked: 0" as a
// success. Existing bookings by the same
// campaign count toward the target, so re-running a request is idempotent, and
// nothing is ever overwritten (unlike the single-assign upsert).
// All counters (requested/booked/missed/…) are in PLAYS; `rowsBooked` reports the
// underlying slot rows for span > 1.
// Auth: admin session. Pushes plan_updated once, batched across stores.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { istWeekday, uniformSlotSpan, SlotCreativeMeta } from '@/lib/slots';
import { planBulkBookings, positionOverlapError, type PlannerMode } from '@/lib/slot-planner';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const DAY_MS        = 86_400_000;
const MAX_STORES    = 100;
// Bookings run for months, not a fortnight: a quarter-long campaign must not have to
// be booked in six separate requests. The availability GRID still stops at 60 dates
// (it is a preview), so the wizard labels its estimate as covering the first 60 days
// — the planner below is exact over the whole range either way.
const MAX_RANGE_DAYS = 186;  // ~6 months
const MAX_PLANNED   = 5000;  // hard stop for a fat-fingered request, not a silent trim

type Body = {
  mode?: 'assign' | 'copy-day';
  campaignId?: string;
  storeIds?: string[];
  from?: string;
  to?: string;
  daysOfWeek?: number;      // Mon..Sun bitmask, default 127 (every day)
  slotsPerDay?: number;     // plays per day (automatic allocation)
  positions?: number[];     // manual allocation: head position of each play
  sourceStoreId?: string;
  sourceDate?: string;
};

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

    // ── Mode-specific validation ─────────────────────────────────────────────
    let targetStoreIds: string[];
    let auditTarget: string;
    let slotsPerDay = 0;      // assign mode: plays per day
    let assignSpan = 1;       // assign mode: positions per play
    let assignCampaignId = '';
    // Manual allocation: the head position of each play, ascending. Empty = automatic.
    let chosenPositions: number[] = [];
    // copy-day: the source day's placements as units (positions sorted ascending).
    let sourceUnits: { positions: number[]; campaignId: string; span: number }[] = [];

    if (mode === 'assign') {
      if (!body.campaignId || !Array.isArray(body.storeIds) || body.storeIds.length === 0) {
        return NextResponse.json({ error: 'campaignId and storeIds[] required' }, { status: 400 });
      }
      if (body.positions !== undefined) {
        if (!Array.isArray(body.positions) || body.positions.length === 0) {
          return NextResponse.json({ error: 'positions must be a non-empty array of loop positions' }, { status: 400 });
        }
        if (body.positions.some((p) => !Number.isInteger(p) || p < 0 || p >= 300)) {
          return NextResponse.json({ error: 'positions must be integers in 0–299' }, { status: 400 });
        }
        // Ascending + de-duplicated: the planner walks them in order and a repeated
        // position would book the same run twice and then report it as a conflict
        // with itself.
        chosenPositions = [...new Set(body.positions)].sort((a, b) => a - b);
        slotsPerDay = chosenPositions.length;
      } else {
        slotsPerDay = body.slotsPerDay ?? 0;
      }
      if (!Number.isInteger(slotsPerDay) || slotsPerDay < 1 || slotsPerDay > 60) {
        return NextResponse.json({ error: 'slotsPerDay must be 1–60' }, { status: 400 });
      }
      const campaign = await db.campaign.findUnique({
        where: { id: body.campaignId },
        select: {
          id: true, status: true,
          slotContent: { select: { id: true, durationMs: true, type: true } },
          slotPlaylist: { select: { items: {
            where: { contentId: { not: null } }, orderBy: { order: 'asc' },
            select: { content: { select: { id: true, durationMs: true, type: true } } },
          } } },
        },
      });
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.status === 'cancelled') {
        return NextResponse.json({ error: 'Campaign is cancelled — pick another' }, { status: 400 });
      }
      const creatives: SlotCreativeMeta[] = (campaign.slotPlaylist?.items ?? [])
        .map((i) => i.content)
        .filter((x): x is NonNullable<typeof x> => x != null)
        .map((x) => ({ contentId: x.id, durationMs: x.durationMs, type: x.type }));
      const metas = creatives.length > 0 ? creatives
        : campaign.slotContent
          ? [{ contentId: campaign.slotContent.id, durationMs: campaign.slotContent.durationMs, type: campaign.slotContent.type }]
          : [];
      const spanned = uniformSlotSpan(metas);
      if ('error' in spanned) return NextResponse.json({ error: spanned.error }, { status: 400 });
      assignSpan = spanned.span;
      const overlap = positionOverlapError(chosenPositions, assignSpan);
      if (overlap) return NextResponse.json({ error: overlap }, { status: 400 });
      assignCampaignId = campaign.id;
      targetStoreIds = [...new Set(body.storeIds)];
      auditTarget = campaign.id;
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
      const sourceRows = await db.slotBooking.findMany({
        where:   {
          storeId: source.id, date: new Date(`${body.sourceDate}T00:00:00Z`),
          slotPosition: { lt: source.loopSlotCount },
          // The assign branch refuses cancelled campaigns; replicating them via
          // copy-day would resurrect a dead brand across a whole month.
          campaign: { status: { not: 'cancelled' } },
        },
        select:  { slotPosition: true, campaignId: true, spanId: true },
        orderBy: { slotPosition: 'asc' },
      });
      if (sourceRows.length === 0) {
        return NextResponse.json({ error: `Nothing to copy — ${body.sourceDate} has no bookings on that store` }, { status: 400 });
      }
      const bySpan = new Map<string, typeof sourceRows>();
      for (const r of sourceRows) {
        if (!r.spanId) {
          sourceUnits.push({ positions: [r.slotPosition], campaignId: r.campaignId, span: 1 });
          continue;
        }
        const list = bySpan.get(r.spanId) ?? [];
        list.push(r);
        bySpan.set(r.spanId, list);
      }
      for (const rows of bySpan.values()) {
        sourceUnits.push({
          positions: rows.map((r) => r.slotPosition).sort((a, b) => a - b),
          campaignId: rows[0].campaignId,
          span: rows.length,
        });
      }
      sourceUnits.sort((a, b) => a.positions[0] - b.positions[0]);
      targetStoreIds = [...new Set(body.storeIds?.length ? body.storeIds : [source.id])];
      auditTarget = `${source.id}:${body.sourceDate}`;
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
      select: { storeId: true, date: true, slotPosition: true, campaignId: true, spanId: true },
    });
    const plannerMode: PlannerMode = mode === 'copy-day'
      ? { kind: 'copy-day', units: sourceUnits, sourceStoreId: body.sourceStoreId!, sourceDate: body.sourceDate! }
      : chosenPositions.length > 0
        ? { kind: 'manual', campaignId: assignCampaignId, span: assignSpan, positions: chosenPositions }
        : { kind: 'auto',   campaignId: assignCampaignId, span: assignSpan, slotsPerDay };

    const { plays, gaps, requested, alreadySatisfied, closedSkipped } = planBulkBookings({
      stores: slotStores.map((s) => ({
        id: s.id, storeName: s.storeName, loopSlotCount: s.loopSlotCount!, openDays: s.openDays,
      })),
      dates,
      existing: existing.map((b) => ({
        storeId:      b.storeId,
        date:         b.date.toISOString().slice(0, 10),
        slotPosition: b.slotPosition,
        campaignId:   b.campaignId,
        spanId:       b.spanId,
      })),
      mode:      plannerMode,
      newSpanId: randomUUID,
    });

    const rows = plays.flatMap((p) => p.positions.map((pos) => ({
      storeId: p.storeId, date: new Date(`${p.date}T00:00:00Z`),
      slotPosition: pos, campaignId: p.campaignId, spanId: p.spanId,
    })));
    if (rows.length > MAX_PLANNED) {
      return NextResponse.json({
        error: `This would create ${rows.length} bookings (max ${MAX_PLANNED} per request) — narrow the date range or store list`,
      }, { status: 400 });
    }

    // One transaction for insert + group-integrity repair. skipDuplicates lets a
    // concurrent admin keep a position they raced us for (their booking survives,
    // our row is dropped) — but a dropped row can leave a multi-slot play with a
    // hole, and "a partial window must never air". Doing the repair in the SAME
    // transaction means (a) no plan fetch can ever observe a partial group — the
    // rows only become visible at commit, already whole-or-absent — and (b) if
    // the repair itself fails, the whole insert rolls back rather than leaving
    // torn groups behind forever.
    const newSpanIds = plays.map((p) => p.spanId).filter((s): s is string => s != null);
    let racedPlays = 0;
    let insertedRows = 0;
    let repairedRows = 0;
    if (rows.length > 0) {
      const txn = await db.$transaction(async (tx) => {
        const result = await tx.slotBooking.createMany({ data: rows, skipDuplicates: true });
        let raced = 0, repaired = 0;
        if (rows.length - result.count > 0 && newSpanIds.length > 0) {
          const landed = await tx.slotBooking.groupBy({
            by: ['spanId'],
            where: { spanId: { in: newSpanIds } },
            _count: { id: true },
          });
          const landedCount = new Map(landed.map((g) => [g.spanId as string, g._count.id]));
          const incomplete: string[] = [];
          let missingGroupRows = 0;
          for (const p of plays) {
            if (!p.spanId) continue;
            const got = landedCount.get(p.spanId) ?? 0;
            if (got > 0 && got < p.positions.length) { incomplete.push(p.spanId); repaired += got; }
            if (got < p.positions.length) { missingGroupRows += p.positions.length - got; if (got === 0) raced++; }
          }
          if (incomplete.length > 0) {
            await tx.slotBooking.deleteMany({ where: { spanId: { in: incomplete } } });
            raced += incomplete.length;
          }
          // Races on single-slot plays: rows lost overall minus rows lost from groups.
          raced += (rows.length - result.count) - missingGroupRows;
        } else {
          raced = rows.length - result.count; // all plays are single rows
        }
        return { inserted: result.count, raced, repaired };
      });
      racedPlays = txn.raced;
      insertedRows = txn.inserted;
      repairedRows = txn.repaired;
    }
    const bookedPlays = plays.length - racedPlays;
    const rowsBooked = insertedRows - repairedRows;

    // One nudge for the whole batch — the whole point of BUG-07's lesson: a bulk
    // write that never tells the players is a booking that airs a day late. Inside
    // after(), not a floating chain: the instance can suspend at response flush,
    // and the next scheduled plan poll is 72 h out.
    const affectedStoreIds = [...new Set(plays.map((p) => p.storeId))];
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
        ...(mode === 'assign'
          ? {
              campaignId: assignCampaignId, slotsPerDay, slotSpan: assignSpan,
              allocation: chosenPositions.length > 0 ? 'manual' : 'auto',
              ...(chosenPositions.length > 0 ? { chosenPositions } : {}),
            }
          : { sourceStoreId: body.sourceStoreId, sourceDate: body.sourceDate }),
        stores: slotStores.length, requested, alreadySatisfied,
        planned: plays.length, booked: bookedPlays, rowsBooked, raced: racedPlays, missed, closedSkipped,
      },
    });

    // Cap the gap detail, never the truth: the aggregate `missed` above is exact.
    const gapsTruncated = gaps.length > 500;

    // Nothing landed and nothing was already covered: report it as a failure.
    // "book what fits" is the right policy for a PARTIAL result, but a request that
    // achieved nothing is not a success with booked: 0 — an operator reading a green
    // toast walks away believing a campaign is on air when no screen will ever play
    // it. Same 409 shape as the success payload, so the UI renders the same gap list.
    if (bookedPlays <= 0 && alreadySatisfied === 0) {
      const reason = requested === 0
        ? (closedSkipped > 0
            ? 'every selected store is closed on the chosen days'
            : 'no store-days matched the selection')
        : racedPlays > 0
          ? 'the positions were taken by another booking while this one was being made'
          : 'the selected stores are fully booked for those positions';
      return NextResponse.json({
        error: `No slots could be booked — ${reason}. Please review the slot booking.`,
        booked: 0, planned: plays.length, requested, alreadySatisfied,
        raced: racedPlays, missed,
        ...(mode === 'assign' ? { slotSpan: assignSpan } : {}),
        rowsBooked: 0,
        gaps: gapsTruncated ? gaps.slice(0, 500) : gaps,
        gapsTruncated, skippedStores, closedSkipped,
      }, { status: 409 });
    }

    return NextResponse.json({
      booked:  bookedPlays,
      planned: plays.length,
      requested,
      alreadySatisfied,
      raced:   racedPlays,
      missed,
      ...(mode === 'assign' ? { slotSpan: assignSpan } : {}),
      rowsBooked,
      gaps: gapsTruncated ? gaps.slice(0, 500) : gaps,
      gapsTruncated,
      skippedStores,
      closedSkipped,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
