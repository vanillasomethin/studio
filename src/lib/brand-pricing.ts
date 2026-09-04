// Single source of truth for brand campaign pricing. Used by the client
// (brand-onboarding + brand dashboard) for display AND by the server
// (/api/razorpay/create-order) to recompute the authoritative charge amount,
// so the price can't be tampered with in the browser.
//
// All amounts here are in RUPEES (the Razorpay order route converts to paise).

export const GST_RATE = 0.18;

// Per-screen monthly pricing, tiered by volume. Two columns per tier:
//   list   — anchor price shown struck through (benchmarked against comparable
//            Indian captive-audience screens, Aug 2026 pricing research)
//   online — what self-serve bookings are actually charged
// Both flow through this module only — the onboarding and dashboard UIs import
// from here, no local price tables. Coupons stack on top of the online price.
export const PRICE_TIERS = [
  { minScreens: 20, list: 999,  online: 699 },
  { minScreens: 10, list: 1099, online: 799 },
  { minScreens: 3,  list: 1199, online: 899 },
  { minScreens: 1,  list: 1299, online: 999 },
] as const;

/** Charged (online) per-screen monthly price for a given screen count. */
export function getScreenPrice(screens: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  for (const t of PRICE_TIERS) if (s >= t.minScreens) return t.online;
  return PRICE_TIERS[PRICE_TIERS.length - 1].online;
}

/** Anchor (list) per-screen monthly price for a given screen count. */
export function getListPrice(screens: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  for (const t of PRICE_TIERS) if (s >= t.minScreens) return t.list;
  return PRICE_TIERS[PRICE_TIERS.length - 1].list;
}

// Longer commitments are discounted, on top of the per-screen volume tiers
// above. Two separate levers on purpose: volume rewards width (more screens),
// duration rewards length (more months), and a booking can earn both.
//
// Thresholds are inclusive and read longest-first, so 6+ months takes 5%.
export const DURATION_DISCOUNTS = [
  { minMonths: 6, rate: 0.05  },
  { minMonths: 3, rate: 0.025 },
] as const;

/** Fractional duration discount for a booking length. 0 for under 3 months. */
export function durationDiscountRate(months: number): number {
  const m = Math.max(1, Math.floor(months || 1));
  for (const d of DURATION_DISCOUNTS) if (m >= d.minMonths) return d.rate;
  return 0;
}

/** Rupees off for the duration discount alone, before any coupon. */
export function durationDiscountRupees(screens: number, months: number): number {
  return Math.round(campaignListBase(screens, months) * durationDiscountRate(months));
}

/** Cost before ANY discount — per-screen price × screens × months. */
export function campaignListBase(screens: number, months: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  const m = Math.max(1, Math.floor(months  || 1));
  return getScreenPrice(s) * s * m;
}

/**
 * Base campaign cost before coupons/GST, in rupees — duration discount applied.
 *
 * The duration discount lives here rather than alongside coupons so that every
 * caller gets it: the browser's displayed total and create-order's authoritative
 * recompute both go through this one function, which is the only reason the two
 * can't drift.
 */
export function campaignBase(screens: number, months: number): number {
  return campaignListBase(screens, months) - durationDiscountRupees(screens, months);
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
  discount?: number;   // rupees off, already validated server-side
  applyGst: boolean;
}): number {
  const base = campaignBase(opts.screens, opts.months);
  const net  = Math.max(0, base - Math.max(0, Math.floor(opts.discount ?? 0)));
  return opts.applyGst ? net + gstOn(net) : net;
}
