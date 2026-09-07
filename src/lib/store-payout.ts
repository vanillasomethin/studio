// Pure arithmetic for a store partner's monthly payout statement.
// DB-bound counterpart: store-payout-db.ts.
//
// A month's payout is three terms:
//   base         — the tier's guaranteed monthly figure, pro-rated to the days
//                  the screen was actually live
//   incentive    — the per-filled-slot incentive, accrued DAY BY DAY
//   electricity  — measured kWh from the store's smart plug (or a proof-of-play
//                  estimate when there is no plug) priced at the fleet tariff
//
// Why daily accrual rather than a single occupancy number: the shipped
// computeStoreMonthlyPayoutPaise (slot-pricing-db.ts:21) counts only TODAY's
// bookings and presents the result as a monthly figure, so a store that ran full
// for 29 days and emptied on the 30th displayed an empty month. Accruing
// base/D and incentive×filled(d)/D over each live day is correct when occupancy
// moves, and collapses to exactly the old formula when it doesn't — a store live
// all month at a constant N filled slots earns storeSlotPayoutPaise(tier, N) to
// the paise. That identity is the contract with what partners have already been
// shown; scripts/verify-store-payout.mjs pins it.

import { estimateCostPaise } from './power';
import {
  STORE_PAYOUT_BASE_PAISE,
  isSlotTier,
  storeSlotIncentivePaise,
  type SlotTier,
} from './slot-pricing';

export type KwhSource = 'metered' | 'estimated';

export type PayoutBreakdown = {
  month: string; // 'YYYY-MM'
  storeId: string;
  mode: 'slot' | 'flat';
  /** slotPricingTier for slot mode, Store.tier for flat mode. */
  tier: string;
  daysInMonth: number;
  /** IST days of the month on/after the store's liveAt day and not in the future. */
  liveDays: number;
  basePaise: number;
  /** Distinct campaigns booked anywhere in the live window — the headline
   *  "how many brands ran on your screen this month". */
  brandsPlayed: number;
  /** Σ over live days of that day's distinct-campaign count. Drives the incentive. */
  filledSlotDays: number;
  /** filledSlotDays / liveDays, 2 dp. Display only — never re-derive money from it. */
  avgFilledSlots: number;
  incentivePaise: number;
  kwh: number;
  kwhSource: KwhSource;
  /** True when an ESTIMATED figure leaned on the fleet-default wattage rather
   *  than this store's surveyed screen — i.e. a guess about the hardware. */
  usingDefaultWatts: boolean;
  paisePerKwh: number;
  electricityPaise: number;
  totalPaise: number;
};

// ─── IST ─────────────────────────────────────────────────────────────────────
//
// This file defines ONE convention and store-payout-db.ts uses only it. The repo
// has five in circulation (tuya-power's private helpers, power.ts's exported
// duplicate, slots.ts's date strings, HourlyPop's UTC buckets, and raw
// new Date(y, m, 1) in bulk-export/store-payments-tab). The last of those is a
// live off-by-5.5h bug: on Vercel the server runs UTC, so a store that went live
// at 2026-10-01 03:00 IST looks like 2026-09-30 21:30 and gets paid for September.

const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, no DST

/** Half-open [start, end) UTC instants bounding an IST calendar month. */
export function monthWindow(month: string): { start: Date; end: Date; days: number } {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Invalid month: ${month}`);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - IST_OFFSET_MS);
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86_400_000) };
}

/** 'YYYY-MM-DD' of an instant, in IST. */
export function istDayKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM' of an instant, in IST. */
export function istMonthKey(at: Date = new Date()): string {
  return istDayKey(at).slice(0, 7);
}

/** Every IST day key in [from, to], inclusive. Both are day keys, not instants. */
export function dayKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = new Date(`${from}T00:00:00Z`).getTime();
  const last = new Date(`${to}T00:00:00Z`).getTime();
  while (cur <= last) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86_400_000;
  }
  return out;
}

/**
 * The IST days of `month` a store was earning: on/after its liveAt day, and not
 * in the future (the current month is paid for what has happened so far).
 * Empty when the store has no liveAt or went live after the month ended —
 * agreedAt is deliberately NOT a fallback, because signing is not a running
 * screen (the rule bulk-export already applies, and the one the admin tab gets
 * wrong today by inflating "total due" with never-live partners).
 */
export function liveDayKeys(month: string, liveAt: Date | null, now: Date = new Date()): string[] {
  if (!liveAt) return [];
  const { start, end } = monthWindow(month);
  if (liveAt.getTime() >= end.getTime()) return [];

  const firstKey = liveAt.getTime() > start.getTime() ? istDayKey(liveAt) : istDayKey(start);
  // The month's last day, or today if the month is still running.
  const lastInstant = new Date(end.getTime() - 86_400_000);
  const todayKey = istDayKey(now);
  const lastKey = istDayKey(lastInstant) < todayKey ? istDayKey(lastInstant) : todayKey;
  if (firstKey > lastKey) return [];
  return dayKeysBetween(firstKey, lastKey);
}

// ─── The payout ──────────────────────────────────────────────────────────────

export type PayoutInputs = {
  month: string;
  storeId: string;
  /** null → flat (playlist) mode; a number → slot mode. */
  loopSlotCount: number | null;
  slotPricingTier: string;
  /** standard | premium — the flat-mode label. */
  storeTier: string;
  monthlyCompensationPaise: number;
  daysInMonth: number;
  liveDays: number;
  /** Day-key → distinct campaigns booked that day, for live days only. */
  filledByDay: Map<string, number>;
  brandsPlayed: number;
  kwh: number;
  kwhSource: KwhSource;
  usingDefaultWatts: boolean;
  paisePerKwh: number;
};

export function computePayout(i: PayoutInputs): PayoutBreakdown {
  const mode: 'slot' | 'flat' = i.loopSlotCount == null ? 'flat' : 'slot';
  const D = Math.max(1, i.daysInMonth); // guard the divisor; monthWindow never returns 0
  const L = Math.max(0, i.liveDays);

  let filledSlotDays = 0;
  for (const n of i.filledByDay.values()) filledSlotDays += Math.max(0, n);

  // Base and incentive both pro-rate on D. A store live for the whole month has
  // L === D, so base is the full tier figure — no silent haircut from rounding.
  let basePaise: number;
  let incentivePaise: number;
  let tier: string;

  if (mode === 'slot') {
    const t: SlotTier = isSlotTier(i.slotPricingTier) ? i.slotPricingTier : 'standard';
    tier = t;
    basePaise = Math.round((STORE_PAYOUT_BASE_PAISE[t] * L) / D);
    incentivePaise = Math.round((storeSlotIncentivePaise(t) * filledSlotDays) / D);
  } else {
    // Playlist-mode stores sell no slots, so there is nothing to incentivise —
    // they keep the flat column (₹500, or ₹1000 premium), pro-rated the same way.
    tier = i.storeTier || 'standard';
    basePaise = Math.round((Math.max(0, i.monthlyCompensationPaise) * L) / D);
    incentivePaise = 0;
  }

  const electricityPaise = estimateCostPaise(i.kwh, i.paisePerKwh);

  return {
    month: i.month,
    storeId: i.storeId,
    mode,
    tier,
    daysInMonth: D,
    liveDays: L,
    basePaise,
    brandsPlayed: Math.max(0, i.brandsPlayed),
    filledSlotDays,
    avgFilledSlots: L > 0 ? Math.round((filledSlotDays / L) * 100) / 100 : 0,
    incentivePaise,
    kwh: i.kwh,
    kwhSource: i.kwhSource,
    usingDefaultWatts: i.usingDefaultWatts,
    paisePerKwh: i.paisePerKwh,
    electricityPaise,
    totalPaise: basePaise + incentivePaise + electricityPaise,
  };
}
