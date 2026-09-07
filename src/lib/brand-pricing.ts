// Single source of truth for brand campaign pricing. Used by the client
// (brand-onboarding + brand dashboard) for display AND by the server
// (/api/razorpay/create-order) to recompute the authoritative charge amount,
// so the price can't be tampered with in the browser.
//
// All amounts here are in RUPEES (the Razorpay order route converts to paise).
//
// Pricing is TIER-BASED, aligned with the admin slot-booking rates in
// lib/slot-pricing.ts: a screen costs its store's slotPricingTier rate
// (Standard ₹1,000 / Growth ₹2,000 / Flagship ₹3,000 per month). Screens the
// buyer did not pin to a specific store are priced Standard — ops routes those
// to standard stores. The old volume tiers (₹999→₹699 by count) are retired;
// which stores you pick is what sets the price now, not how many.

import { SLOT_TIER_RATE_RUPEES, SLOT_TIERS, isSlotTier, type SlotTier } from './slot-pricing';

export { SLOT_TIER_RATE_RUPEES, SLOT_TIERS, isSlotTier };
export type { SlotTier };

export const GST_RATE = 0.18;

/** Monthly rate for one screen at a store of the given tier. */
export function tierRate(tier: SlotTier): number {
  return SLOT_TIER_RATE_RUPEES[tier];
}

/**
 * Monthly subtotal for a campaign's screen mix. `tiers` carries one entry per
 * map-picked store; any remaining screens (count-mode bookings, or picked ids
 * that didn't resolve to a real store) are priced Standard. Extra tiers beyond
 * `screens` are ignored so a hostile long array can't inflate anything.
 */
export function monthlySubtotal(screens: number, tiers: SlotTier[] = []): number {
  const s = Math.max(1, Math.floor(screens || 1));
  const picked = tiers.slice(0, s);
  const unpicked = s - picked.length;
  return picked.reduce((sum, t) => sum + SLOT_TIER_RATE_RUPEES[t], 0)
    + unpicked * SLOT_TIER_RATE_RUPEES.standard;
}

/** Screens per tier for a picked mix, unpicked screens counted as Standard. */
export function tierCounts(screens: number, tiers: SlotTier[] = []): Record<SlotTier, number> {
  const s = Math.max(1, Math.floor(screens || 1));
  const counts: Record<SlotTier, number> = { standard: 0, growth: 0, flagship: 0 };
  for (const t of tiers.slice(0, s)) counts[t] += 1;
  counts.standard += s - tiers.slice(0, s).length;
  return counts;
}

/** Base campaign cost before discounts/GST, in rupees. */
export function campaignBase(screens: number, months: number, tiers: SlotTier[] = []): number {
  const m = Math.max(1, Math.floor(months || 1));
  return monthlySubtotal(screens, tiers) * m;
}

export function gstOn(net: number): number {
  return Math.round(net * GST_RATE);
}

/**
 * Final charge in rupees for a campaign.
 * @param applyGst  whether this flow adds 18% GST (preserves each flow's existing behaviour)
 */
export function campaignTotal(opts: {
  screens: number;
  months: number;
  tiers?: SlotTier[]; // one entry per map-picked store; rest priced Standard
  discount?: number;   // rupees off, already validated server-side
  applyGst: boolean;
}): number {
  const base = campaignBase(opts.screens, opts.months, opts.tiers ?? []);
  const net  = Math.max(0, base - Math.max(0, Math.floor(opts.discount ?? 0)));
  return opts.applyGst ? net + gstOn(net) : net;
}
