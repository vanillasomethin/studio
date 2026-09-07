// GET /api/admin/store-payments/preview?month=YYYY-MM[&storeId=…]
//
// What every live store is owed for a month, with the derivation attached —
// base + slot incentive + electricity. This is what the payments tab renders and
// what "Pay this shop" pays; nothing in the UI computes money of its own.
//
// Settled months report the FROZEN breakdown off the payment row rather than a
// recomputation, so reopening a paid month shows what was actually paid even
// after PlugReading's 180-day prune or a cascade has removed the evidence.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { computeStorePayoutBatch, frozenToBreakdown } from '@/lib/store-payout-db';
import { istMonthKey, monthWindow } from '@/lib/store-payout';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? istMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  const storeId = searchParams.get('storeId');

  try {
    const { end } = monthWindow(month);

    // liveAt, not agreedAt: a partner who signed but never went live is owed
    // nothing, and counting them inflates the tab's "total due".
    const stores = await db.store.findMany({
      where: { liveAt: { not: null, lt: end }, ...(storeId ? { id: storeId } : {}) },
      select: {
        id: true, storeName: true, ownerName: true, whatsapp: true, city: true,
        photoUrl: true, upiId: true, payoutMethod: true, liveAt: true,
        loopSlotCount: true, slotPricingTier: true, tier: true,
        monthlyCompensationPaise: true, screenWatts: true,
      },
      orderBy: { storeName: 'asc' },
    });
    if (stores.length === 0) return NextResponse.json({ month, stores: [] });

    const [computed, payments] = await Promise.all([
      computeStorePayoutBatch(month, stores.map((s) => ({
        id: s.id, liveAt: s.liveAt, loopSlotCount: s.loopSlotCount,
        slotPricingTier: s.slotPricingTier, tier: s.tier,
        monthlyCompensationPaise: s.monthlyCompensationPaise, screenWatts: s.screenWatts,
      }))),
      db.storePayment.findMany({ where: { month, storeId: { in: stores.map((s) => s.id) } } }),
    ]);
    const paymentByStore = new Map(payments.map((p) => [p.storeId, p]));

    return NextResponse.json({
      month,
      stores: stores.map((s) => {
        const payment = paymentByStore.get(s.id) ?? null;
        const frozen = payment ? frozenToBreakdown(payment) : null;
        return {
          id: s.id,
          storeName: s.storeName,
          ownerName: s.ownerName,
          whatsapp: s.whatsapp,
          city: s.city,
          photoUrl: s.photoUrl,
          upiId: s.upiId,
          payoutMethod: s.payoutMethod,
          liveAt: s.liveAt,
          loopSlotCount: s.loopSlotCount,
          // Frozen wins for a settled month — see the header note.
          breakdown: frozen ?? computed.get(s.id) ?? null,
          settled: !!frozen,
          payment,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
