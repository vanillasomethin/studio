// Slot pricing tiers — pure math. DB-bound counterpart: slot-pricing-db.ts.
//
// Standard/Growth/Flagship (₹1,000/2,000/3,000 per slot per month) replace the old
// flat ₹1,000/slot pricing. A store is admin-assigned one tier (Store.slotPricingTier);
// every position in that store's loop is billed and paid out at that tier's rate.
//
// Brand price for N positions bought at a store = N × the store's tier rate — this is
// a live formula, not restricted to any fixed package size.
//
// Store payout: a guaranteed monthly base for the tier (₹650/₹1,150/₹1,650), paid
// every month irrespective of occupancy, PLUS a per-filled-slot incentive on top.
// The base never switches off — a partner who sells slots is never worse off than
// one whose loop is empty.
//
// Plays/day for a slot is unrelated to tier (tier is pricing/payout only, not
// playback frequency) — see loopRepeatsPerDay in lib/slots.ts for that, unchanged.

export type SlotTier = 'standard' | 'growth' | 'flagship';

export const SLOT_TIERS: SlotTier[] = ['standard', 'growth', 'flagship'];

export function isSlotTier(v: string | null | undefined): v is SlotTier {
  return v === 'standard' || v === 'growth' || v === 'flagship';
}

export const SLOT_TIER_RATE_RUPEES: Record<SlotTier, number> = {
  standard: 1000,
  growth: 2000,
  flagship: 3000,
};

/** Guaranteed monthly base per tier — paid every month regardless of occupancy. */
export const STORE_PAYOUT_BASE_PAISE: Record<SlotTier, number> = {
  standard: 65_000, // ₹650
  growth: 115_000,  // ₹1,150
  flagship: 165_000, // ₹1,650
};

/** Kept as the old name so existing imports don't break. @deprecated use STORE_PAYOUT_BASE_PAISE */
export const STORE_PAYOUT_FLOOR_PAISE = STORE_PAYOUT_BASE_PAISE;

export const STORE_PAYOUT_RATE = 0.10; // per-filled-slot incentive, as a share of the tier rate

/** What a brand pays for `positions` slots at a store on the given tier, per month. */
export function slotBookingPriceRupees(tier: SlotTier, positions: number): number {
  return SLOT_TIER_RATE_RUPEES[tier] * Math.max(0, positions);
}

/** Per-filled-slot incentive in paise, for one slot at this tier. */
export function storeSlotIncentivePaise(tier: SlotTier): number {
  return Math.round(SLOT_TIER_RATE_RUPEES[tier] * 100 * STORE_PAYOUT_RATE);
}

/**
 * Store's monthly slot payout: the tier's guaranteed base, plus the per-slot
 * incentive for every filled slot. The base is unconditional — it is never
 * traded against the incentive, so payout rises monotonically with occupancy.
 */
export function storeSlotPayoutPaise(tier: SlotTier, filledCount: number): number {
  const filled = Math.max(0, filledCount);
  return STORE_PAYOUT_BASE_PAISE[tier] + storeSlotIncentivePaise(tier) * filled;
}
