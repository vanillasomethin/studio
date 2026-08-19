// GET /api/stores/slot-occupancy?storeId=…
// Store partner's own screen: how many of today's slots are filled, and which brands
// are currently running elsewhere in the network but not yet on this screen.
// Auth: store-partner pattern — resolveStoreId, never auth()-gated (see CLAUDE.md).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { istToday } from '@/lib/slots';
import { filledSlotCount } from '@/lib/slot-pricing-db';

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const store = await db.store.findUnique({ where: { id: storeId }, select: { loopSlotCount: true } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.loopSlotCount == null) return NextResponse.json({ slotMode: false });

    const today = istToday();
    const [filledCount, hereRows, elsewhereRows] = await Promise.all([
      filledSlotCount(storeId, today),
      db.slotBooking.findMany({
        where: { storeId, date: new Date(`${today}T00:00:00Z`) },
        select: { campaignId: true }, distinct: ['campaignId'],
      }),
      db.slotBooking.findMany({
        where: { date: new Date(`${today}T00:00:00Z`), storeId: { not: storeId } },
        select: { campaignId: true, storeId: true }, distinct: ['campaignId', 'storeId'],
      }),
    ]);
    const hereIds = new Set(hereRows.map((r) => r.campaignId));

    const storeCountByCampaign = new Map<string, number>();
    for (const r of elsewhereRows) {
      if (hereIds.has(r.campaignId)) continue;
      storeCountByCampaign.set(r.campaignId, (storeCountByCampaign.get(r.campaignId) ?? 0) + 1);
    }

    const missingIds = [...storeCountByCampaign.keys()]
      .sort((a, b) => (storeCountByCampaign.get(b) ?? 0) - (storeCountByCampaign.get(a) ?? 0))
      .slice(0, 10);
    const campaigns = missingIds.length
      ? await db.campaign.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true, brand: { select: { brandName: true } } } })
      : [];
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));

    return NextResponse.json({
      slotMode: true,
      loopSlotCount: store.loopSlotCount,
      filledCount,
      openSlots: Math.max(0, store.loopSlotCount - filledCount),
      missingBrands: missingIds.map((id) => ({
        campaignId: id,
        brandName: campaignById.get(id)?.brand?.brandName ?? campaignById.get(id)?.name ?? 'A brand',
        storeCount: storeCountByCampaign.get(id) ?? 0,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
