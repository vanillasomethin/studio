// DB-bound counterpart to store-payout.ts — resolves a store's monthly payout
// statement: base + slot incentive + electricity, for a named IST month.
//
// This is the figure the admin pays and the partner sees. Both read THIS
// function, so the two can never disagree — the dashboard used to compute its
// own rupee figure locally while the DB row said something else.
//
// Settled months are not recomputed. Once a StorePayment row carries a frozen
// breakdown (computedAt set), frozenToBreakdown() replays it verbatim: the
// sources this function reads are all destructible — PlugReading self-prunes at
// 180 days (tuya-power.ts:26), deleting a Device cascades away its PlayEvents,
// deleting a Campaign cascades away its SlotBookings — so a recomputation months
// later would quietly produce a different number than the one that was paid.

import type { StorePayment } from '@prisma/client';
import { db } from './db';
import type { PowerEstimate } from './power';
import { getPowerSettings, estimateStorePower } from './power-db';
import {
  computePayout,
  istDayKey,
  liveDayKeys,
  monthWindow,
  type KwhSource,
  type PayoutBreakdown,
} from './store-payout';

/** Columns computeStorePayout needs off Store. */
const STORE_SELECT = {
  id: true,
  liveAt: true,
  loopSlotCount: true,
  slotPricingTier: true,
  tier: true,
  monthlyCompensationPaise: true,
  screenWatts: true,
} as const;

type PayoutStore = {
  id: string;
  liveAt: Date | null;
  loopSlotCount: number | null;
  slotPricingTier: string;
  tier: string;
  monthlyCompensationPaise: number;
  screenWatts: number | null;
};

/**
 * One store's statement for one IST month. Prefer the batch version for any
 * fleet-wide view — this issues its own queries.
 */
export async function computeStorePayout(
  storeId: string,
  month: string,
  now: Date = new Date(),
): Promise<PayoutBreakdown | null> {
  const store = await db.store.findUnique({ where: { id: storeId }, select: STORE_SELECT });
  if (!store) return null;
  const map = await computeStorePayoutBatch(month, [store], now);
  return map.get(storeId) ?? null;
}

/**
 * Batched statements for a set of stores. Issues a FIXED number of queries
 * regardless of fleet size — one SlotBooking sweep, one PlugReading rollup, and
 * whatever estimateStorePower needs — because the admin payments tab renders
 * every live store for a month at once and a per-store loop would be an N+1
 * against the three largest tables in the schema.
 *
 * Pass `stores` to avoid a re-fetch; omit it to bill every store with a liveAt.
 */
export async function computeStorePayoutBatch(
  month: string,
  stores?: PayoutStore[],
  now: Date = new Date(),
): Promise<Map<string, PayoutBreakdown>> {
  const { start, end, days } = monthWindow(month);
  const out = new Map<string, PayoutBreakdown>();

  const rows: PayoutStore[] = stores ?? (await db.store.findMany({
    // liveAt, not agreedAt: signing is not a running screen, and paying on the
    // signature pays for nothing (the rule bulk-export already applies).
    where: { liveAt: { not: null, lt: end } },
    select: STORE_SELECT,
  }));
  if (rows.length === 0) return out;

  const ids = rows.map((s) => s.id);

  // Live-day sets first — they bound every other lookup, and a store that wasn't
  // live at all this month needs no queries run against it.
  const liveDaysByStore = new Map<string, Set<string>>();
  for (const s of rows) liveDaysByStore.set(s.id, new Set(liveDayKeys(month, s.liveAt, now)));

  const { paisePerKwh } = await getPowerSettings();

  // ── Bookings: one sweep, deduped to (store, day, campaign) ────────────────
  // SlotBooking.date is a @db.Date, so its instants are IST midnights stored as
  // UTC dates — compare against the day keys, not the window instants.
  const bookings = await db.slotBooking.findMany({
    where: {
      storeId: { in: ids },
      date: { gte: new Date(`${istDayKey(start)}T00:00:00Z`), lt: new Date(`${istDayKey(end)}T00:00:00Z`) },
    },
    select: { storeId: true, date: true, campaignId: true },
    distinct: ['storeId', 'date', 'campaignId'],
  });

  const filledByStore = new Map<string, Map<string, number>>();
  const brandsByStore = new Map<string, Set<string>>();
  for (const b of bookings) {
    // b.date is the IST calendar date stored at UTC midnight — slice it directly
    // rather than shifting it again, which would roll it back a day.
    const dayKey = b.date.toISOString().slice(0, 10);
    if (!liveDaysByStore.get(b.storeId)?.has(dayKey)) continue; // pre-live / future day
    const perDay = filledByStore.get(b.storeId) ?? new Map<string, number>();
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
    filledByStore.set(b.storeId, perDay);
    const brands = brandsByStore.get(b.storeId) ?? new Set<string>();
    brands.add(b.campaignId);
    brandsByStore.set(b.storeId, brands);
  }

  // ── Electricity: metered first, estimate as the fallback ──────────────────
  const plugs = await db.smartPlug.findMany({
    where: { storeId: { in: ids } },
    select: { id: true, storeId: true },
  });
  const meteredByStore = new Map<string, number>();
  if (plugs.length > 0) {
    const sums = await db.plugReading.groupBy({
      by: ['plugId'],
      where: { plugId: { in: plugs.map((p) => p.id) }, at: { gte: start, lt: end } },
      _sum: { energyWh: true },
      _count: true,
    });
    const storeOfPlug = new Map(plugs.map((p) => [p.id, p.storeId]));
    for (const s of sums) {
      const sid = storeOfPlug.get(s.plugId);
      // A window with readings but zero energy is a legitimately dark screen and
      // stays 'metered'. A window with NO readings — never polled, or pruned past
      // the 180-day horizon — has nothing to stand on and falls to the estimate.
      if (sid && s._count > 0) meteredByStore.set(sid, (s._sum.energyWh ?? 0) / 1000);
    }
  }

  const needEstimate = rows.filter((s) => !meteredByStore.has(s.id));
  const estimates: Map<string, PowerEstimate> = needEstimate.length
    ? await estimateStorePower(
        needEstimate.map((s) => ({ id: s.id, screenWatts: s.screenWatts })),
        start,
        end,
      )
    : new Map();

  // ── Compose ───────────────────────────────────────────────────────────────
  for (const s of rows) {
    const metered = meteredByStore.get(s.id);
    const est = estimates.get(s.id);
    const kwh = metered ?? est?.kwh ?? 0;
    const kwhSource: KwhSource = metered != null ? 'metered' : 'estimated';

    out.set(s.id, computePayout({
      month,
      storeId: s.id,
      loopSlotCount: s.loopSlotCount,
      slotPricingTier: s.slotPricingTier,
      storeTier: s.tier,
      monthlyCompensationPaise: Number(s.monthlyCompensationPaise ?? 50_000),
      daysInMonth: days,
      liveDays: liveDaysByStore.get(s.id)?.size ?? 0,
      filledByDay: filledByStore.get(s.id) ?? new Map(),
      brandsPlayed: brandsByStore.get(s.id)?.size ?? 0,
      kwh,
      kwhSource,
      usingDefaultWatts: kwhSource === 'estimated' && (est?.usingDefaultWatts ?? true),
      paisePerKwh,
    }));
  }
  return out;
}

/** True once a payment row carries a frozen breakdown worth replaying. */
export function isFrozen(p: Pick<StorePayment, 'computedAt'> | null | undefined): boolean {
  return !!p?.computedAt;
}

/**
 * Rebuild the statement that was actually settled, from the row itself. Used for
 * any paid month so the partner and the auditor see the numbers that were paid,
 * not a recomputation against sources that have since been pruned or cascaded away.
 */
export function frozenToBreakdown(p: StorePayment): PayoutBreakdown | null {
  if (!p.computedAt) return null;
  const base = p.basePaise ?? 0;
  const incentive = p.incentivePaise ?? 0;
  const electricity = p.electricityPaise ?? 0;
  const liveDays = p.liveDays ?? 0;
  const filledSlotDays = p.filledSlotDays ?? 0;
  return {
    month: p.month,
    storeId: p.storeId,
    mode: (p.payoutMode === 'slot' ? 'slot' : 'flat'),
    tier: p.tierAtPayout ?? 'standard',
    daysInMonth: p.daysInMonth ?? 30,
    liveDays,
    basePaise: base,
    brandsPlayed: p.brandsPlayed ?? 0,
    filledSlotDays,
    avgFilledSlots: p.avgFilledSlots ?? (liveDays > 0 ? Math.round((filledSlotDays / liveDays) * 100) / 100 : 0),
    incentivePaise: incentive,
    kwh: p.kwh ?? 0,
    kwhSource: p.kwhSource === 'metered' ? 'metered' : 'estimated',
    usingDefaultWatts: false,
    paisePerKwh: p.paisePerKwh ?? 0,
    electricityPaise: electricity,
    // The row's amountPaise is the truth about what was paid — an admin override
    // can legitimately differ from base+incentive+electricity.
    totalPaise: p.amountPaise,
  };
}

/** The columns a freeze writes. Spread into a Prisma create/update payload. */
export function freezeColumns(b: PayoutBreakdown) {
  return {
    basePaise: b.basePaise,
    incentivePaise: b.incentivePaise,
    electricityPaise: b.electricityPaise,
    kwh: b.kwh,
    kwhSource: b.kwhSource,
    paisePerKwh: b.paisePerKwh,
    brandsPlayed: b.brandsPlayed,
    filledSlotDays: b.filledSlotDays,
    avgFilledSlots: b.avgFilledSlots,
    liveDays: b.liveDays,
    daysInMonth: b.daysInMonth,
    tierAtPayout: b.tier,
    payoutMode: b.mode,
    computedAt: new Date(),
  };
}
