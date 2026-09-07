// GET /api/brand/store-availability
// Every slot-mode store with today's open-slot count, for the self-serve request flow
// (pick where to spend credits). Auth: next-auth session (any brand).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { istToday } from '@/lib/slots';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stores = await db.store.findMany({
    where: { loopSlotCount: { not: null } },
    select: { id: true, storeName: true, city: true, loopSlotCount: true },
    orderBy: [{ city: 'asc' }, { storeName: 'asc' }],
  });
  if (stores.length === 0) return NextResponse.json({ stores: [] });

  const today = istToday();
  const rows = await db.slotBooking.findMany({
    where: { storeId: { in: stores.map((s) => s.id) }, date: new Date(`${today}T00:00:00Z`) },
    select: { storeId: true, campaignId: true },
    distinct: ['storeId', 'campaignId'],
  });
  const filledByStore = new Map<string, number>();
  for (const r of rows) filledByStore.set(r.storeId, (filledByStore.get(r.storeId) ?? 0) + 1);

  return NextResponse.json({
    stores: stores.map((s) => {
      const filledCount = filledByStore.get(s.id) ?? 0;
      return {
        storeId: s.id, storeName: s.storeName, city: s.city,
        loopSlotCount: s.loopSlotCount!, filledCount,
        openSlots: Math.max(0, s.loopSlotCount! - filledCount),
      };
    }),
  });
}
