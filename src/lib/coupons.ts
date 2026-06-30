// Server-side coupon resolution, shared by /api/coupons/validate (UI preview)
// and /api/razorpay/create-order (authoritative charge). Keeping one
// implementation means the discount the browser shows and the discount the
// server actually applies can never drift apart.

import { db } from '@/lib/db';

export type CouponResult =
  | { valid: false; error: string }
  | { valid: true; code: string; type: 'FLAT' | 'PERCENT'; value: number; discount: number };

/**
 * Validate a code against the DB and compute the discount (in rupees) for a
 * given subtotal. Checks active / expiry / redemption cap. Never throws on a
 * bad code — returns `{ valid: false }`.
 */
export async function resolveCoupon(rawCode: string, subtotalRupees: number): Promise<CouponResult> {
  const code = (rawCode ?? '').trim().toUpperCase();
  const sub  = Math.max(0, Math.floor(Number(subtotalRupees) || 0));
  if (!code) return { valid: false, error: 'Enter a code.' };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { valid: false, error: 'Invalid promo code' };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: 'This code has expired' };
  }
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
    return { valid: false, error: 'This code is no longer available' };
  }

  const discount = coupon.type === 'PERCENT'
    ? Math.min(sub, Math.round((sub * coupon.value) / 100))
    : Math.min(sub, coupon.value);

  return { valid: true, code: coupon.code, type: coupon.type, value: coupon.value, discount };
}
