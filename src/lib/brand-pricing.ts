// Single source of truth for brand campaign pricing. Used by the client
// (brand-onboarding + brand dashboard) for display AND by the server
// (/api/razorpay/create-order) to recompute the authoritative charge amount,
// so the price can't be tampered with in the browser.
//
// All amounts here are in RUPEES (the Razorpay order route converts to paise).

export const GST_RATE = 0.18;

// Per-screen monthly price drops with volume. Keep in sync with the marketing
// tiers shown on the onboarding page.
export function getScreenPrice(screens: number): number {
  if (screens >= 20) return 549;
  if (screens >= 10) return 599;
  if (screens >= 3)  return 699;
  return 799;
}

/** Base campaign cost before discounts/GST, in rupees. */
export function campaignBase(screens: number, months: number): number {
  const s = Math.max(1, Math.floor(screens || 1));
  const m = Math.max(1, Math.floor(months  || 1));
  return getScreenPrice(s) * s * m;
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
