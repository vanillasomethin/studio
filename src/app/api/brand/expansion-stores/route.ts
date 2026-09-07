// GET /api/brand/expansion-stores?campaignId=…
// Which slot-mode stores in the network don't carry this campaign yet, so the brand
// can see where to expand. Auth: next-auth session; campaign must belong to the brand.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, email: session.user.email }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  try {
    const [slotStores, covered] = await Promise.all([
      db.store.findMany({ where: { loopSlotCount: { not: null } }, select: { id: true, storeName: true, city: true } }),
      db.slotBooking.findMany({ where: { campaignId }, select: { storeId: true }, distinct: ['storeId'] }),
    ]);
    const coveredIds = new Set(covered.map((c) => c.storeId));
    const missing = slotStores.filter((s) => !coveredIds.has(s.id));

    return NextResponse.json({
      totalSlotStores: slotStores.length,
      coveredStores: slotStores.length - missing.length,
      missingStores: missing.slice(0, 20).map((s) => ({ storeId: s.id, storeName: s.storeName, city: s.city })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
