// GET /api/brand/slot-credits?campaignId=…
// Credit balance (granted from Campaign.screens, minus pending+approved requests) plus
// this campaign's request history. Auth: next-auth session; campaign must belong to the brand.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCreditBalance } from '@/lib/slot-requests-db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, email: session.user.email }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const [balance, requests] = await Promise.all([
    getCreditBalance(campaignId),
    db.slotRequest.findMany({
      where: { campaignId },
      orderBy: { requestedAt: 'desc' },
      take: 20,
      include: { store: { select: { storeName: true, city: true } } },
    }),
  ]);

  return NextResponse.json({
    balance,
    requests: requests.map((r) => ({
      id: r.id, storeId: r.storeId, storeName: r.store.storeName, city: r.store.city,
      window: r.window, creditsCost: r.creditsCost, status: r.status, note: r.note,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    })),
  });
}
