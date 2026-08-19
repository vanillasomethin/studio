// Slot pricing tiers — pure math. DB-bound counterpart: slot-pricing-db.ts.
//
// Standard/Growth/Flagship (₹1,000/2,000/3,000 per slot per month) replace the old
// flat ₹1,000/slot pricing. A store is admin-assigned one tier (Store.slotPricingTier);
// every position in that store's loop is billed and paid out at that tier's rate.
//
// Brand price for N positions bought at a store = N × the store's tier rate — this is
// a live formula, not restricted to any fixed package size.
//
// Store payout: 10% of the tier rate per filled slot, plus a flat floor when nothing
// is filled yet (the "still worth having the screen" guarantee). The floor only
// applies at zero — from the first filled slot onward it's the 10% formula, even
// where that's numerically less than the floor.
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

export const STORE_PAYOUT_FLOOR_PAISE: Record<SlotTier, number> = {
  standard: 65_000, // ₹650
  growth: 115_000,  // ₹1,150
  flagship: 165_000, // ₹1,650
};

export const STORE_PAYOUT_RATE = 0.10; // 10% of the tier rate, per filled slot

/** What a brand pays for `positions` slots at a store on the given tier, per month. */
export function slotBookingPriceRupees(tier: SlotTier, positions: number): number {
  return SLOT_TIER_RATE_RUPEES[tier] * Math.max(0, positions);
}

/** Store's monthly slot payout: the flat floor at zero occupancy, else 10% of the
 *  tier rate for every filled slot (never blended — no filled slots ever falls back
 *  to the formula at ₹0, and any filled slot ever falls back to the floor). */
export function storeSlotPayoutPaise(tier: SlotTier, filledCount: number): number {
  if (filledCount <= 0) return STORE_PAYOUT_FLOOR_PAISE[tier];
  const perSlotPaise = Math.round(SLOT_TIER_RATE_RUPEES[tier] * 100 * STORE_PAYOUT_RATE);
  return perSlotPaise * filledCount;
}
