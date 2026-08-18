// DB-bound counterpart to reach.ts — resolves a campaign's Verified Footfall /
// Estimated Reach split from PlayEvent, StoreSensorHealth and FootfallHourly.

import { db } from './db';
import { isSensorCovered, summarizeReach, type ReachSummary } from './reach';

function flightWindow(startDate: Date, months: number, now: Date) {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + Math.max(1, months));
  return { from: startDate, to: now < end ? now : end };
}

const EMPTY_SUMMARY: ReachSummary = {
  verifiedFootfall: 0, verifiedStoreCount: 0,
  estimatedReach: 0, estimatedStoreCount: 0,
  totalStoreCount: 0,
};

export async function computeCampaignReach(campaignId: string, now: Date = new Date()): Promise<ReachSummary> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { startDate: true, months: true },
  });
  if (!campaign) return EMPTY_SUMMARY;

  const { from, to } = flightWindow(campaign.startDate, campaign.months, now);

  // Stores this campaign actually played at, via PlayEvent -> Device.storeId,
  // plus each store's impressions (the Estimated Reach source for uncovered stores).
  const playEvents = await db.playEvent.findMany({
    where: { campaignId, startedAt: { gte: from, lte: to } },
    select: { impressions: true, device: { select: { storeId: true } } },
  });

  const impressionsByStore = new Map<string, number>();
  for (const pe of playEvents) {
    const storeId = pe.device.storeId;
    if (!storeId) continue;
    impressionsByStore.set(storeId, (impressionsByStore.get(storeId) ?? 0) + pe.impressions);
  }
  const storeIds = [...impressionsByStore.keys()];
  if (storeIds.length === 0) return EMPTY_SUMMARY;

  const sensorHealth = await db.storeSensorHealth.findMany({
    where: { storeId: { in: storeIds } },
    select: { storeId: true, ruviewLastSeen: true },
  });
  const coveredStoreIds = new Set(
    sensorHealth.filter((s) => isSensorCovered(s.ruviewLastSeen, now)).map((s) => s.storeId),
  );

  const footfallByStore = new Map<string, number>();
  if (coveredStoreIds.size > 0) {
    const hourly = await db.footfallHourly.groupBy({
      by: ['storeId'],
      where: { storeId: { in: [...coveredStoreIds] }, hourBucket: { gte: from, lte: to } },
      _sum: { customerCount: true },
    });
    for (const row of hourly) {
      footfallByStore.set(row.storeId, row._sum.customerCount ?? 0);
    }
  }

  return summarizeReach({ storeIds, coveredStoreIds, footfallByStore, impressionsByStore });
}
