// POST /api/coupons/validate — public. Validates a coupon code against the DB
// and returns the discount (in rupees) for a given subtotal. Used by the brand
// onboarding flow for live preview; the authoritative discount is recomputed
// server-side again at order creation (see /api/razorpay/create-order).
// Body: { code: string, subtotal: number }  (subtotal in rupees)

import { NextRequest, NextResponse } from 'next/server';
import { resolveCoupon } from '@/lib/coupons';

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json() as { code?: string; subtotal?: number };
    const result = await resolveCoupon(code ?? '', subtotal ?? 0);

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
    }
    return NextResponse.json({
      valid: true, code: result.code, type: result.type, value: result.value, discount: result.discount,
    });
  } catch {
    return NextResponse.json({ valid: false, error: 'Could not validate code.' }, { status: 500 });
  }
}
