import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';

export async function GET(req: NextRequest) {
  try {
    const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payments = await db.storePayment.findMany({
      where: { storeId },
      // month/status/amountPaise/paidAt/payRef must stay present and unrenamed —
      // store-app/app/(dashboard)/earnings.tsx casts this array directly, and its
      // fetch swallows errors, so a shape change would silently render every
      // month as unpaid. The breakdown fields are additive; old clients ignore them.
      select: {
        month: true, status: true, amountPaise: true, paidAt: true, payRef: true,
        basePaise: true, incentivePaise: true, electricityPaise: true,
        kwh: true, kwhSource: true, brandsPlayed: true, avgFilledSlots: true,
        payoutMode: true, computedAt: true,
      },
      orderBy: { month: 'asc' },
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error('stores/payments GET error', e);
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 });
  }
}
