// GET /api/stores/slot-occupancy?storeId=…
// Store partner's own screen: what is actually playing in today's loop, how many
// slots are filled, and which brands run elsewhere in the network but not here yet.
// Auth: store-partner pattern — resolveStoreId, never auth()-gated (see CLAUDE.md).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicUrl } from '@/lib/r2';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { istToday, buildSlotLoop, slotDayIndex, slotSpanForDuration } from '@/lib/slots';
import { resolveFillerCampaign, campaignCreatives, activeSlotPlans, CAMPAIGN_SLOT_CREATIVES_SELECT } from '@/lib/slots-db';
import { filledSlotCount } from '@/lib/slot-pricing-db';

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { loopSlotCount: true, fillerCreativeId: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.loopSlotCount == null) return NextResponse.json({ slotMode: false });

    const today = istToday();
    const todayDate = new Date(`${today}T00:00:00Z`);
    const [filledCount, bookings, elsewhereRows, filler] = await Promise.all([
      filledSlotCount(storeId, today),
      db.slotBooking.findMany({
        where:   { storeId, date: todayDate },
        orderBy: { slotPosition: 'asc' },
        select: {
          slotPosition: true, campaignId: true, spanId: true,
          campaign: {
            select: {
              id: true, name: true,
              brand: { select: { brandName: true } },
              ...CAMPAIGN_SLOT_CREATIVES_SELECT,
            },
          },
        },
      }),
      db.slotBooking.findMany({
        where: { date: todayDate, storeId: { not: storeId } },
        select: { campaignId: true, storeId: true }, distinct: ['campaignId', 'storeId'],
      }),
      resolveFillerCampaign(store.fillerCreativeId),
    ]);

    // The same composition the player will actually receive — bonus redistribution
    // and house filler included — rather than a count of booked rows. A partner
    // looking at their screen sees what is on it, not what was sold.
    const loop = buildSlotLoop(
      store.loopSlotCount,
      bookings.map((b) => {
        const creatives = campaignCreatives(b.campaign);
        return {
          slotPosition: b.slotPosition,
          campaignId:   b.campaignId,
          creativeIds:  creatives.map((c) => c.contentId),
          spanId:       b.spanId,
          creativeSpan: creatives.length ? Math.max(...creatives.map((c) => slotSpanForDuration(c.durationMs))) : 1,
        };
      }),
      filler,
      slotDayIndex(today),
      new Map(),
      await activeSlotPlans(storeId, today),
    );

    const contentIds = [...new Set(loop.map((a) => a.contentId))];
    const contents = contentIds.length
      ? await db.content.findMany({
          where:  { id: { in: contentIds } },
          select: { id: true, name: true, objectKey: true, type: true },
        })
      : [];
    const contentById = new Map(contents.map((c) => [c.id, c]));

    // The builder reports the fill reason directly (sold | plan | bonus | filler);
    // deriving it here from isFiller was only ever correct while standing
    // assignments did not exist.
    const brandByCampaign = new Map(
      bookings.map((b) => [b.campaignId, b.campaign.brand?.brandName ?? b.campaign.name ?? 'A brand']),
    );
    // Plan campaigns hold no booking here, so their names are not in the map above —
    // without this a standing assignment shows as an unnamed brand.
    const planCampaignIds = [...new Set(loop.filter((a) => a.source === 'plan').map((a) => a.campaignId))]
      .filter((id) => !brandByCampaign.has(id));
    if (planCampaignIds.length) {
      const planCampaigns = await db.campaign.findMany({
        where:  { id: { in: planCampaignIds } },
        select: { id: true, name: true, brand: { select: { brandName: true } } },
      });
      for (const c of planCampaigns) brandByCampaign.set(c.id, c.brand?.brandName ?? c.name ?? 'A brand');
    }

    const entries = loop.map((a) => {
      const c = contentById.get(a.contentId);
      const source = a.source;
      return {
        position:    a.slotPosition,
        spanSlots:   a.spanSlots,
        source,
        campaignId:  a.campaignId,
        // Null for house filler — it belongs to ALIVE, not to a brand.
        brandName:   source === 'filler' ? null : (brandByCampaign.get(a.campaignId) ?? 'A brand'),
        contentName: c?.name ?? null,
        // Videos have no poster frame, so this is the media itself. The caller
        // renders an icon for video rather than pretending it is a thumbnail.
        contentUrl:  c ? publicUrl(c.objectKey) : null,
        contentType: c ? c.type.toLowerCase() as 'image' | 'video' : null,
      };
    });

    // Per-brand rollup — what a partner actually reads. Counted in POSITIONS, so a
    // 30s ad occupying three of them reads as three, matching the strip above it.
    const byCampaign = new Map<string, { campaignId: string; brandName: string; slots: number; guaranteed: number }>();
    let houseSlots = 0;
    for (const e of entries) {
      if (e.source === 'filler') { houseSlots += e.spanSlots; continue; }
      const row = byCampaign.get(e.campaignId)
        ?? { campaignId: e.campaignId, brandName: e.brandName ?? 'A brand', slots: 0, guaranteed: 0 };
      row.slots += e.spanSlots;
      if (e.source === 'sold') row.guaranteed += e.spanSlots;
      byCampaign.set(e.campaignId, row);
    }
    const onScreen = [...byCampaign.values()].sort((a, b) => b.slots - a.slots);

    const hereIds = new Set(bookings.map((b) => b.campaignId));
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
      date: today,
      filledCount,
      openSlots: Math.max(0, store.loopSlotCount - filledCount),
      houseSlots,
      loop: entries,
      onScreen,
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
