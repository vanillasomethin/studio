// GET /api/stores/payout-statement?month=YYYY-MM
//
// The partner's own statement for a month: what they are owed and why —
// base + slot incentive + electricity, with the kWh figure's provenance.
//
// A separate endpoint rather than more fields on /api/stores/payments, because
// that route returns a bare array the mobile app casts directly and reshaping it
// breaks the app silently (its fetch swallows errors and renders every month as
// unpaid). This one is additive and web-first.
//
// Reads the SAME computeStorePayout the admin pays from, so the number a partner
// sees and the number ops transfers can never drift apart.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { computeStorePayout, frozenToBreakdown } from '@/lib/store-payout-db';
import { istMonthKey } from '@/lib/store-payout';

export async function GET(req: NextRequest) {
  try {
    const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const month = req.nextUrl.searchParams.get('month') ?? istMonthKey();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    }

    const payment = await db.storePayment.findUnique({
      where: { storeId_month: { storeId, month } },
    });

    // A settled month replays its frozen breakdown; an open one is computed live
    // and the client labels it an estimate.
    const frozen = payment ? frozenToBreakdown(payment) : null;
    const breakdown = frozen ?? (await computeStorePayout(storeId, month));
    if (!breakdown) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    return NextResponse.json({
      month,
      settled: !!frozen,
      breakdown,
      payment: payment
        ? {
            status: payment.status,
            amountPaise: payment.amountPaise,
            paidAt: payment.paidAt,
            payRef: payment.payRef,
          }
        : null,
    });
  } catch (e) {
    console.error('stores/payout-statement GET error', e);
    return NextResponse.json({ error: 'Failed to load statement' }, { status: 500 });
  }
}
