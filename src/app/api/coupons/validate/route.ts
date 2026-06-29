// POST /api/coupons/validate — public. Validates a coupon code against the DB
// and returns the discount (in rupees) for a given subtotal. Used by the brand
// onboarding flow. Server-authoritative: checks active / expiry / redemption cap.
// Body: { code: string, subtotal: number }  (subtotal in rupees)
// Resp: { valid: true, code, type, discount } | { valid: false, error }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json() as { code?: string; subtotal?: number };
    const normalized = (code ?? '').trim().toUpperCase();
    const sub = Math.max(0, Math.floor(Number(subtotal) || 0));

    if (!normalized) {
      return NextResponse.json({ valid: false, error: 'Enter a code.' }, { status: 400 });
    }

    const coupon = await db.coupon.findUnique({ where: { code: normalized } });

    if (!coupon || !coupon.active) {
      return NextResponse.json({ valid: false, error: 'Invalid promo code' }, { status: 200 });
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: 'This code has expired' }, { status: 200 });
    }
    if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
      return NextResponse.json({ valid: false, error: 'This code is no longer available' }, { status: 200 });
    }

    const discount = coupon.type === 'PERCENT'
      ? Math.min(sub, Math.round((sub * coupon.value) / 100))
      : Math.min(sub, coupon.value);

    // `value` is returned so the client can re-derive the discount live if the
    // order size changes after the code is applied (esp. PERCENT coupons).
    return NextResponse.json({ valid: true, code: coupon.code, type: coupon.type, value: coupon.value, discount });
  } catch {
    return NextResponse.json({ valid: false, error: 'Could not validate code.' }, { status: 500 });
  }
}
