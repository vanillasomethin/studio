// Single source of truth for brand campaign pricing. Used by the client
// (brand-onboarding + brand dashboard) for display AND by the server
// (/api/razorpay/create-order) to recompute the authoritative charge amount,
// so the price can't be tampered with in the browser.
//
// All amounts here are in RUPEES (the Razorpay order route converts to paise).

import { SLOT_TIER_RATE_RUPEES, isSlotTier, type SlotTier } from './slot-pricing';

export const GST_RATE = 0.18;

// ─── Store-tier pricing (current model) ──────────────────────────────────────
//
// A brand is billed by WHICH stores it picked, at each store's network tier:
// Standard ₹1,000 / Growth ₹2,000 / Flagship ₹3,000 per store per month. Those
// rates are SLOT_TIER_RATE_RUPEES in slot-pricing.ts — deliberately the same
// table the partner payout is derived from, so there is one rate card and the
// buy side and the pay side can never drift apart.
//
// A booking that picks no stores (the plain 1/3/10/20 screen cards) is quoted at
// the Standard rate and ops assigns Standard stores. There is no volume
// discount in this model — see the deprecation note on PRICE_TIERS below.

/** What a brand pays for ONE store for ONE month, at that store's tier. */
export function storeMonthlyPrice(tier: SlotTier): number {
  return SLOT_TIER_RATE_RUPEES[tier];
}

/** Coerce a raw DB/API string to a tier. Unknown → standard: a bad column value
 *  must never invent a premium store the brand is then charged for. */
export function asTier(v: string | null | undefined): SlotTier {
  return isSlotTier(v) ? v : 'standard';
}

const clampScreens = (n: number) => Math.min(50, Math.max(1, Math.floor(n || 1)));
const clampMonths  = (n: number) => Math.min(12, Math.max(1, Math.floor(n || 1)));

/** Base rupees for a campaign that picked specific stores. */
export function campaignBaseForStores(tiers: SlotTier[], months: number): number {
  const m = clampMonths(months);
  return tiers.reduce((sum, t) => sum + storeMonthlyPrice(t), 0) * m;
}

/** Base rupees for a plain screen count — quoted at the Standard rate. */
export function campaignBaseForCount(screens: number, months: number): number {
  return storeMonthlyPrice('standard') * clampScreens(screens) * clampMonths(months);
}

// ─── Legacy volume band (DEPRECATED) ─────────────────────────────────────────
//
// @deprecated Superseded by the store-tier rates above. Billing now follows the
// stores a brand selects, so a per-screen volume band no longer describes any
// price this platform charges. Kept only so nothing that still imports it fails
// to build — do NOT use these for a new displayed or charged number, and note
// that the `list` anchor is now BELOW the charged rate at 20 screens (₹999 vs
// ₹1,000), which is why the struck-through anchor was removed from the UI.
export const PRICE_TIERS = [
  { minScreens: 20, list: 999,  online: 699 },
  { minScreens: 10, list: 1099, online: 799 },
  { minScreens: 3,  list: 1199, online: 899 },
  { minScreens: 1,  list: 1299, online: 999 },
] as const;

/** @deprecated Volume band — see the note on PRICE_TIERS. Use storeMonthlyPrice. */
export function getScreenPrice(screens: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  for (const t of PRICE_TIERS) if (s >= t.minScreens) return t.online;
  return PRICE_TIERS[PRICE_TIERS.length - 1].online;
}

/** @deprecated Anchor for the retired volume band — see the note on PRICE_TIERS. */
export function getListPrice(screens: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  for (const t of PRICE_TIERS) if (s >= t.minScreens) return t.list;
  return PRICE_TIERS[PRICE_TIERS.length - 1].list;
}

/** Base campaign cost before discounts/GST, in rupees. Delegates to the
 *  count path so the retired volume band has exactly one place it could leak
 *  from — and no longer does. */
export function campaignBase(screens: number, months: number): number {
  return campaignBaseForCount(screens, months);
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
  /** The picked stores' tiers. When non-empty this — not `screens` — sets the
   *  price, because the bill follows the stores the brand actually chose. */
  tiers?: SlotTier[];
  discount?: number;   // rupees off, already validated server-side
  applyGst: boolean;
}): number {
  const base = opts.tiers && opts.tiers.length > 0
    ? campaignBaseForStores(opts.tiers, opts.months)
    : campaignBaseForCount(opts.screens, opts.months);
  const net  = Math.max(0, base - Math.max(0, Math.floor(opts.discount ?? 0)));
  return opts.applyGst ? net + gstOn(net) : net;
}
