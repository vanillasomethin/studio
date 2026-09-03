// DB-bound counterpart to sla.ts — closes due billing cycles against Proof-of-Play
// and resolves the live makegood weighting for lib/slots.ts buildSlotLoop.

import { db } from './db';
import { loopRepeatsPerDay } from './slots';
import { cycleBounds, evaluateCycle, remainingMakegoodWeight, type GuaranteeCycleResult } from './sla';

/** Sum of (booked slots that day × that store's loop repeats/day) across a date range —
 *  the cycle's "promised plays" figure. Uses each store's CURRENT loop config (same
 *  simplification /api/brand/slot-stats already makes for "today"); loop configs
 *  change rarely enough that this is accurate in practice for a just-closed cycle. */
async function sumPromisedPlays(campaignId: string, from: Date, to: Date): Promise<number> {
  // PLAYS, not rows: a multi-slot placement (30s ad = 3 rows sharing a spanId) is
  // ONE play per loop pass — counting rows promised 3× what proof-of-play can ever
  // deliver and manufactured a phantom shortfall (then makegood/credit) for every
  // span campaign.
  const rows = await db.slotBooking.findMany({
    where:  { campaignId, date: { gte: from, lt: to } },
    select: { storeId: true, date: true, spanId: true },
  });
  if (rows.length === 0) return 0;

  const playsByCell = new Map<string, number>();
  const seenSpans = new Set<string>();
  for (const r of rows) {
    const cell = `${r.storeId}|${r.date.toISOString().slice(0, 10)}`;
    if (r.spanId) {
      const spanKey = `${cell}|${r.spanId}`;
      if (seenSpans.has(spanKey)) continue;
      seenSpans.add(spanKey);
    }
    playsByCell.set(cell, (playsByCell.get(cell) ?? 0) + 1);
  }

  const storeIds = [...new Set(rows.map((b) => b.storeId))];
  const stores = await db.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, loopSlotCount: true, hoursStart: true, hoursEnd: true },
  });
  const storeMap = new Map(stores.map((s) => [s.id, s]));

  let total = 0;
  for (const [cell, plays] of playsByCell) {
    const s = storeMap.get(cell.split('|')[0]);
    if (!s?.loopSlotCount) continue;
    total += plays * loopRepeatsPerDay({
      loopSlotCount: s.loopSlotCount, hoursStart: s.hoursStart, hoursEnd: s.hoursEnd,
    });
  }
  return total;
}

async function countDeliveredGuaranteedPlays(campaignId: string, from: Date, to: Date): Promise<number> {
  return db.playEvent.count({
    where: { campaignId, isFiller: false, slotPosition: { not: null }, startedAt: { gte: from, lt: to } },
  });
}

/** Idempotent: creates a PlayGuaranteeCycle row for every cycle of this campaign that
 *  has fully elapsed and doesn't have one yet. Safe to call on every dashboard read —
 *  the unique (campaignId, cycleIndex) constraint makes a race between two concurrent
 *  requests a harmless no-op on the loser. */
export async function closeDueCycles(campaignId: string, now: Date = new Date()): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { startDate: true, months: true, screens: true, pricePerScreen: true },
  });
  if (!campaign) return;

  const existing = await db.playGuaranteeCycle.findMany({
    where: { campaignId }, select: { cycleIndex: true },
  });
  const done = new Set(existing.map((e) => e.cycleIndex));
  const cyclePriceRupees = campaign.pricePerScreen * campaign.screens;

  for (let i = 0; i < campaign.months; i++) {
    if (done.has(i)) continue;
    const { cycleStart, cycleEnd } = cycleBounds(campaign.startDate, i);
    if (now < cycleEnd) break; // cycles close in order — nothing later is due yet either

    const [promisedPlays, deliveredPlays] = await Promise.all([
      sumPromisedPlays(campaignId, cycleStart, cycleEnd),
      countDeliveredGuaranteedPlays(campaignId, cycleStart, cycleEnd),
    ]);

    const result = evaluateCycle({
      cycleIndex: i, cycleStart, cycleEnd, promisedPlays, deliveredPlays,
      hasNextCycle: i + 1 < campaign.months,
      cyclePriceRupees,
    });

    await db.playGuaranteeCycle.create({
      data: {
        campaignId, cycleIndex: result.cycleIndex,
        cycleStart: result.cycleStart, cycleEnd: result.cycleEnd,
        promisedPlays: result.promisedPlays, deliveredPlays: result.deliveredPlays,
        shortfallPlays: result.shortfallPlays, remedyType: result.remedyType,
        makegoodBalance: result.makegoodBalance, creditAmount: result.creditAmount,
      },
    }).catch(() => {}); // unique-constraint race with a concurrent request — fine to drop
  }
}

export type SlaSummary = {
  cycles: (GuaranteeCycleResult & { id: string })[];
  current: { cycleIndex: number; cycleStart: Date; cycleEnd: Date; promisedPlays: number; deliveredPlays: number } | null;
};

/** Closes any newly-due cycles, then returns the full cycle history plus a running
 *  (not-yet-closed) counter for the cycle in progress — the brand dashboard's
 *  "plays delivered vs promised" figure. */
export async function getSlaSummary(campaignId: string, now: Date = new Date()): Promise<SlaSummary> {
  await closeDueCycles(campaignId, now);

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { startDate: true, months: true },
  });
  const rows = await db.playGuaranteeCycle.findMany({
    where: { campaignId }, orderBy: { cycleIndex: 'asc' },
  });
  const cycles = rows.map((r) => ({
    id: r.id, cycleIndex: r.cycleIndex, cycleStart: r.cycleStart, cycleEnd: r.cycleEnd,
    promisedPlays: r.promisedPlays, deliveredPlays: r.deliveredPlays, shortfallPlays: r.shortfallPlays,
    remedyType: r.remedyType as 'makegood' | 'credit' | null,
    makegoodBalance: r.makegoodBalance, creditAmount: r.creditAmount,
  }));

  if (!campaign) return { cycles, current: null };

  const closedIndexes = new Set(cycles.map((c) => c.cycleIndex));
  let current: SlaSummary['current'] = null;
  for (let i = 0; i < campaign.months; i++) {
    if (closedIndexes.has(i)) continue;
    const { cycleStart, cycleEnd } = cycleBounds(campaign.startDate, i);
    if (now < cycleStart) break; // not started yet
    const [promisedPlays, deliveredPlays] = await Promise.all([
      sumPromisedPlays(campaignId, cycleStart, now < cycleEnd ? now : cycleEnd),
      countDeliveredGuaranteedPlays(campaignId, cycleStart, now < cycleEnd ? now : cycleEnd),
    ]);
    current = { cycleIndex: i, cycleStart, cycleEnd, promisedPlays, deliveredPlays };
    break;
  }

  return { cycles, current };
}

/** Outstanding makegood weight per campaign, for buildSlotLoop's bonus-pool
 *  round-robin (lib/slots.ts). Read-time derived: makegoodBalance is the amount
 *  granted at cycle-close; the remaining balance subtracts bonus plays the campaign
 *  has received since the earliest still-relevant grant. Bounded query set — callers
 *  only pass the handful of campaignIds actually sold at one store. */
export async function getMakegoodWeights(campaignIds: string[], now: Date = new Date()): Promise<Map<string, number>> {
  if (campaignIds.length === 0) return new Map();

  const grants = await db.playGuaranteeCycle.findMany({
    where: { campaignId: { in: campaignIds }, remedyType: 'makegood', makegoodBalance: { gt: 0 } },
    select: { campaignId: true, makegoodBalance: true, cycleEnd: true },
  });
  if (grants.length === 0) return new Map();

  const byCampaign = new Map<string, { granted: number; earliestEnd: Date }>();
  for (const g of grants) {
    const prev = byCampaign.get(g.campaignId);
    if (!prev) byCampaign.set(g.campaignId, { granted: g.makegoodBalance, earliestEnd: g.cycleEnd });
    else {
      prev.granted += g.makegoodBalance;
      if (g.cycleEnd < prev.earliestEnd) prev.earliestEnd = g.cycleEnd;
    }
  }

  const weights = new Map<string, number>();
  await Promise.all([...byCampaign.entries()].map(async ([campaignId, { granted, earliestEnd }]) => {
    const delivered = await db.playEvent.count({
      where: { campaignId, isFiller: true, slotPosition: { not: null }, startedAt: { gte: earliestEnd, lte: now } },
    });
    const weight = remainingMakegoodWeight(granted, delivered);
    if (weight > 0) weights.set(campaignId, weight);
  }));
  return weights;
}
