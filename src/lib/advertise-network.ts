// The screen network as the advertiser landing page presents it, plus the
// rate-card maths behind the estimator.
//
// Rates come from lib/slot-pricing.ts rather than being restated here, so the
// page can never quote a price the booking system doesn't charge.
//
// BRAND-FACING ONLY. Nothing in this file — or in anything that renders it — may
// show what a store is paid. Do not import STORE_PAYOUT_* / storeSlotPayoutPaise
// from lib/slot-pricing.ts into the /advertise tree.

import { SLOT_TIER_RATE_RUPEES, type SlotTier } from '@/lib/slot-pricing';

export type { SlotTier };

/** What one slot is, spelled out once. Everything else on the page derives from these. */
export const SLOT_SECONDS = 10;
export const PLAYS_PER_DAY_PER_SLOT = 144;
export const SCREEN_HOURS_PER_DAY = 14;
/** 144 × 10s = 1,440s = 24 minutes of screen time a day, per slot, per store. */
export const MINUTES_PER_DAY_PER_SLOT = (PLAYS_PER_DAY_PER_SLOT * SLOT_SECONDS) / 60;

/** One brand may hold at most 10 of the positions in any single screen's loop. */
export const MAX_SLOTS_PER_STORE = 10;
export const MIN_SLOTS_PER_STORE = 1;
export const MIN_MONTHS = 1;
export const MAX_MONTHS = 12;

export const TIER_ORDER: SlotTier[] = ['flagship', 'growth', 'standard'];

export const TIER_META: Record<SlotTier, { label: string; blurb: string }> = {
  flagship: {
    label: 'Flagship',
    // TODO: confirm the footfall claim with ops before this goes live.
    blurb: 'The busiest supermarkets on the list — high footfall, long queues, big baskets.',
  },
  growth: {
    label: 'Growth',
    blurb: 'Established neighbourhood supermarkets with steady daily regulars.',
  },
  standard: {
    label: 'Standard',
    blurb: 'Smaller shops that anchor one locality. The cheapest way to test a creative.',
  },
};

export type NetworkStore = {
  id: string;
  name: string;
  tier: SlotTier;
  lat: number;
  lng: number;
};

// TODO: every lat/lng below is a placeholder dropped on the right neighbourhood,
// not a surveyed shop location. Replace each one with the store's real pin from
// Admin → Stores before this page is published.
export const NETWORK_STORES: NetworkStore[] = [
  // Flagship
  { id: 'nilgiris-mg-road',            name: 'Nilgiris MG Road',            tier: 'flagship', lat: 12.8752, lng: 74.8433 }, // TODO: real coords
  { id: 'bhargavi-hyper-mart-mg-road', name: 'Bhargavi Hyper Mart MG Road', tier: 'flagship', lat: 12.8778, lng: 74.8447 }, // TODO: real coords
  { id: 'apple-mart-falnir',           name: 'Apple Mart Falnir',           tier: 'flagship', lat: 12.8686, lng: 74.8462 }, // TODO: real coords
  { id: 'apple-mart-padavinangady',    name: 'Apple Mart Padavinangady',    tier: 'flagship', lat: 12.8931, lng: 74.8536 }, // TODO: real coords
  { id: 'misbah-falnir',               name: 'Misbah Falnir',               tier: 'flagship', lat: 12.8709, lng: 74.8489 }, // TODO: real coords
  { id: 'fathima-stores-hampankatta',  name: 'Fathima Stores Hampankatta',  tier: 'flagship', lat: 12.8703, lng: 74.8421 }, // TODO: real coords

  // Growth
  { id: 'margins-bejai',                 name: 'Margins Bejai',                 tier: 'growth', lat: 12.8865, lng: 74.8471 }, // TODO: real coords
  { id: 'baliga-bejai-kapikad',          name: 'Baliga Bejai–Kapikad',          tier: 'growth', lat: 12.8912, lng: 74.8489 }, // TODO: real coords
  { id: 'apple-mart-kadri',              name: 'Apple Mart Kadri',              tier: 'growth', lat: 12.8884, lng: 74.8598 }, // TODO: real coords
  { id: 'misbah-marnamikatte',           name: 'Misbah Marnamikatte',           tier: 'growth', lat: 12.8801, lng: 74.8515 }, // TODO: real coords
  { id: 'fathima-superstore-kankanady',  name: 'Fathima Superstore Kankanady',  tier: 'growth', lat: 12.8648, lng: 74.8557 }, // TODO: real coords
  { id: 'nilgiris-urwa',                 name: 'Nilgiris Urwa',                 tier: 'growth', lat: 12.8846, lng: 74.8382 }, // TODO: real coords
  { id: 'bhargavi-super-mart-derebail',  name: 'Bhargavi Super Mart Derebail',  tier: 'growth', lat: 12.9004, lng: 74.8402 }, // TODO: real coords
  { id: 'katteyangadi',                  name: 'Katteyangadi',                  tier: 'growth', lat: 12.9057, lng: 74.8551 }, // TODO: real coords
  { id: 'super-foodmart-bendoor',        name: 'Super Foodmart Bendoor',        tier: 'growth', lat: 12.8693, lng: 74.8514 }, // TODO: real coords
  { id: 'kadri-mart',                    name: 'Kadri Mart',                    tier: 'growth', lat: 12.8925, lng: 74.8623 }, // TODO: real coords
  { id: 'impala-z-mart',                 name: 'Impala Z Mart',                 tier: 'growth', lat: 12.8823, lng: 74.8455 }, // TODO: real coords

  // Standard
  { id: 'market-7-kankanady', name: 'Market 7 Kankanady', tier: 'standard', lat: 12.8662, lng: 74.8583 }, // TODO: real coords
  { id: 'mary-hill-store',    name: 'Mary Hill Store',    tier: 'standard', lat: 12.8843, lng: 74.8341 }, // TODO: real coords
  { id: 'a-h-store-falnir',   name: 'A H Store Falnir',   tier: 'standard', lat: 12.8671, lng: 74.8437 }, // TODO: real coords
];

export const STORES_BY_TIER: { tier: SlotTier; stores: NetworkStore[] }[] = TIER_ORDER.map(tier => ({
  tier,
  stores: NETWORK_STORES.filter(s => s.tier === tier),
}));

export function storeById(id: string): NetworkStore | undefined {
  return NETWORK_STORES.find(s => s.id === id);
}

/** Monthly rate a brand pays for one slot at one store on this tier. */
export function tierRate(tier: SlotTier): number {
  return SLOT_TIER_RATE_RUPEES[tier];
}

export type Estimate = {
  storeCount: number;
  slots: number;
  months: number;
  monthlyRupees: number;
  totalRupees: number;
  playsPerDay: number;
  minutesPerDay: number;
  /** Per-tier breakdown, in TIER_ORDER, tiers with no stores selected dropped. */
  byTier: { tier: SlotTier; storeCount: number; monthlyRupees: number }[];
};

/**
 * The whole rate card in one function: price is linear in slots, in months and
 * in stores, so a selection is just the sum of each store's tier rate × slots.
 */
export function estimate(selectedIds: readonly string[], slots: number, months: number): Estimate {
  const stores = selectedIds.map(storeById).filter((s): s is NetworkStore => Boolean(s));
  const safeSlots = clamp(slots, MIN_SLOTS_PER_STORE, MAX_SLOTS_PER_STORE);
  const safeMonths = clamp(months, MIN_MONTHS, MAX_MONTHS);

  const byTier = TIER_ORDER.map(tier => {
    const count = stores.filter(s => s.tier === tier).length;
    return { tier, storeCount: count, monthlyRupees: count * tierRate(tier) * safeSlots };
  }).filter(row => row.storeCount > 0);

  const monthlyRupees = byTier.reduce((sum, row) => sum + row.monthlyRupees, 0);

  return {
    storeCount: stores.length,
    slots: safeSlots,
    months: safeMonths,
    monthlyRupees,
    totalRupees: monthlyRupees * safeMonths,
    playsPerDay: stores.length * safeSlots * PLAYS_PER_DAY_PER_SLOT,
    minutesPerDay: stores.length * safeSlots * MINUTES_PER_DAY_PER_SLOT,
    byTier,
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹18,000 · ₹1,20,000 — Indian digit grouping, no paise. */
export function formatInr(rupees: number): string {
  return INR.format(Math.round(rupees));
}

const COUNT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 1,44,000 — same grouping, for plays and minutes. */
export function formatCount(n: number): string {
  return COUNT.format(Math.round(n));
}
