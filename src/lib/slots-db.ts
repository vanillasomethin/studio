// Database-backed slot-loop helpers. Split from lib/slots.ts so the loop/availability
// math there stays pure (no Prisma import) and unit-testable.

import { db } from '@/lib/db';
import { isOpenOn, istToday, slotSpanForDuration } from '@/lib/slots';

// ── Loop resizing ─────────────────────────────────────────────────────────────

export type SlotMove = {
  bookingId:    string;
  date:         string;
  from:         number;
  to:           number;
  campaignId:   string;
  campaignName: string;
};

export type CompactionPlan =
  | { ok: true;  moves: SlotMove[] }
  | { ok: false; date: string; stranded: number; free: number };

/**
 * Plans how to fit a store's upcoming bookings into a loop of `newCount` positions.
 *
 * Shrinking the loop strands any booking at position >= newCount: the player skips
 * out-of-range positions, so a paid slot would silently stop playing. Rather than
 * blocking the resize, pack those bookings down into whatever positions are free on
 * the same date — the loop position is an internal detail, not something a brand buys,
 * so moving it costs them nothing (every slot plays once per loop either way).
 *
 * Only reports failure when a date genuinely has more bookings than the new loop can
 * hold — real oversell, which needs a human decision about who to drop. Planning is
 * all-or-nothing across dates so a rejected resize never half-applies.
 *
 * Past dates are ignored: they have already aired and their play logs are history.
 * newCount = 0 (leaving slot mode) naturally has no free positions, so any upcoming
 * booking blocks it.
 */
export async function planSlotCompaction(storeId: string, newCount: number): Promise<CompactionPlan> {
  const upcoming = await db.slotBooking.findMany({
    where:  { storeId, date: { gte: new Date(`${istToday()}T00:00:00Z`) } },
    select: {
      id: true, date: true, slotPosition: true, campaignId: true, spanId: true,
      campaign: { select: { name: true } },
    },
    orderBy: [{ date: 'asc' }, { slotPosition: 'asc' }],
  });

  const byDate = new Map<string, typeof upcoming>();
  for (const b of upcoming) {
    const key = b.date.toISOString().slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(b);
    byDate.set(key, list);
  }

  const moves: SlotMove[] = [];
  for (const [date, rows] of byDate) {
    // A multi-slot placement moves as a unit: if ANY member is stranded past the
    // new count, the whole group relocates to a free RUN of its size, keeping the
    // window contiguous. Singles (spanId null) move one position each, as before.
    type Unit = { rows: typeof rows };
    const bySpan = new Map<string, typeof rows>();
    const units: Unit[] = [];
    for (const r of rows) {
      if (!r.spanId) { units.push({ rows: [r] }); continue; }
      const list = bySpan.get(r.spanId) ?? [];
      list.push(r);
      bySpan.set(r.spanId, list);
    }
    for (const groupRows of bySpan.values()) units.push({ rows: groupRows });

    const strandedUnits = units.filter((u) => u.rows.some((r) => r.slotPosition >= newCount));
    if (strandedUnits.length === 0) continue;
    const strandedRows = strandedUnits.reduce((n, u) => n + u.rows.length, 0);

    // Targets must be genuinely empty positions — not positions a stranded unit is
    // vacating — so the per-row updates inside one transaction can never collide
    // regardless of order.
    const occupied = new Set(rows.map((r) => r.slotPosition));
    const free: number[] = [];
    for (let p = 0; p < newCount; p++) if (!occupied.has(p)) free.push(p);

    // First-fit into free runs, largest units first so a big window is not
    // squeezed out by singles taking the only long run.
    const runs: number[][] = [];
    for (const p of free) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1] === p - 1) last.push(p);
      else runs.push([p]);
    }
    const placed: { unit: Unit; positions: number[] }[] = [];
    let unplaceable = false;
    for (const unit of [...strandedUnits].sort((a, b) => b.rows.length - a.rows.length)) {
      const need = unit.rows.length;
      const run = runs.find((r) => r.length >= need);
      if (!run) { unplaceable = true; break; }
      placed.push({ unit, positions: run.splice(0, need) });
    }
    if (unplaceable) {
      return { ok: false, date, stranded: strandedRows, free: free.length };
    }
    for (const { unit, positions } of placed) {
      const ordered = [...unit.rows].sort((a, b) => a.slotPosition - b.slotPosition);
      ordered.forEach((s, i) => moves.push({
        bookingId:    s.id,
        date,
        from:         s.slotPosition,
        to:           positions[i],
        campaignId:   s.campaignId,
        campaignName: s.campaign.name,
      }));
    }
  }
  return { ok: true, moves };
}

/** Applies a planned compaction. Single transaction — a partially-moved loop would
 *  leave some paid slots unplayable, which is exactly what this is preventing. */
export async function applySlotMoves(moves: SlotMove[]): Promise<void> {
  if (moves.length === 0) return;
  await db.$transaction(
    moves.map((m) => db.slotBooking.update({
      where: { id: m.bookingId },
      data:  { slotPosition: m.to },
    })),
  );
}

/** Resolves the effective filler campaign for a store: per-store override, else the
 *  global PlayerConfig default. Null when neither is set or the campaign has no
 *  playable slot creative. Filler is a single-slot mechanism (10s creatives only —
 *  it fills scattered single empties), so longer creatives are dropped here even if
 *  someone attaches them; if none survive, there is no filler. */
export async function resolveFillerCampaign(
  storeFillerCampaignId: string | null,
): Promise<{ campaignId: string; creativeIds: string[] } | null> {
  let campaignId = storeFillerCampaignId;
  if (!campaignId) {
    const cfg = await db.playerConfig.findUnique({ where: { id: 1 }, select: { fillerCampaignId: true } });
    campaignId = cfg?.fillerCampaignId ?? null;
  }
  if (!campaignId) return null;
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      slotContent: { select: { id: true, durationMs: true } },
      slotPlaylist: { select: { items: {
        where: { contentId: { not: null } }, orderBy: { order: 'asc' },
        select: { content: { select: { id: true, durationMs: true } } },
      } } },
    },
  });
  if (!campaign) return null;
  const candidates = campaign.slotPlaylist && campaign.slotPlaylist.items.length > 0
    ? campaign.slotPlaylist.items.map((i) => i.content).filter((c): c is NonNullable<typeof c> => c != null)
    : campaign.slotContent ? [campaign.slotContent] : [];
  const tenSecond = candidates
    .filter((c) => slotSpanForDuration(c.durationMs) === 1)
    .map((c) => c.id);
  // Never-dark beats grid purity: a filler configured BEFORE the 10s rule (all its
  // creatives longer) must not silently vanish on deploy and blank zero-booking
  // days. Grandfather the whole set — the player truncates each play at the slot
  // boundary — until someone re-cuts or re-points the filler. New configs can't
  // get here (fillerCampaignError rejects >10s at assignment time).
  const creativeIds = tenSecond.length > 0 ? tenSecond : candidates.map((c) => c.id);
  if (creativeIds.length === 0) return null;
  return { campaignId: campaign.id, creativeIds };
}

/** Sold-count availability per store per date, honouring open_days exclusion.
 *  Closed dates are returned with sold=null so UIs can grey them out.
 *
 *  Only counts bookings INSIDE the store's current loop (slotPosition < loopSlotCount).
 *  A shrunk loop can strand bookings above the new count; buildSlotLoop already ignores
 *  those, so counting them here would report more sold than the loop has positions and
 *  read as "sold out" on a store that still has free slots. The settings route blocks
 *  shrinking past sold inventory, so strays should not exist — this keeps the arithmetic
 *  honest regardless (legacy rows, direct DB edits). */
export async function availabilityGrid(
  stores: { id: string; openDays: number; loopSlotCount: number }[],
  dates: string[],
): Promise<Map<string, Map<string, number | null>>> {
  const countMap = new Map<string, number>();
  if (stores.length && dates.length) {
    const dateFilter = {
      gte: new Date(`${dates[0]}T00:00:00Z`),
      lte: new Date(`${dates[dates.length - 1]}T00:00:00Z`),
    };
    // Stores can run different loop sizes, so bucket by size and issue one grouped
    // query per distinct size (a handful at most) rather than per store.
    const bySize = new Map<number, string[]>();
    for (const s of stores) {
      const list = bySize.get(s.loopSlotCount) ?? [];
      list.push(s.id);
      bySize.set(s.loopSlotCount, list);
    }
    const results = await Promise.all(
      [...bySize.entries()].map(([loopSlotCount, storeIds]) =>
        db.slotBooking.groupBy({
          by: ['storeId', 'date'],
          where: { storeId: { in: storeIds }, date: dateFilter, slotPosition: { lt: loopSlotCount } },
          _count: { id: true },
        }),
      ),
    );
    for (const c of results.flat()) {
      countMap.set(`${c.storeId}|${c.date.toISOString().slice(0, 10)}`, c._count.id);
    }
  }

  const grid = new Map<string, Map<string, number | null>>();
  for (const s of stores) {
    const row = new Map<string, number | null>();
    for (const d of dates) {
      row.set(d, isOpenOn(s.openDays, d) ? (countMap.get(`${s.id}|${d}`) ?? 0) : null);
    }
    grid.set(s.id, row);
  }
  return grid;
}
