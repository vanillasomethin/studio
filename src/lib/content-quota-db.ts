// DB-bound counterpart to content-quota.ts — counts this month's creative changes
// from AuditLog (action='creative_change', target=campaignId; see /api/brand/upload).

import { db } from './db';
import { isSlotTier, type SlotTier } from './slot-pricing';
import { canChangeContent, contentChangesRemaining } from './content-quota';

function istMonthStart(now: Date = new Date()): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
  return new Date(start.getTime() - IST_OFFSET_MS);
}

export async function changesUsedThisMonth(campaignId: string): Promise<number> {
  return db.auditLog.count({
    where: { action: 'creative_change', target: campaignId, createdAt: { gte: istMonthStart() } },
  });
}

export type ContentQuotaStatus = { tier: SlotTier; used: number; remaining: number | null; allowed: boolean };

export async function getContentQuotaStatus(campaignId: string): Promise<ContentQuotaStatus> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { slotPricingTier: true } });
  const tier: SlotTier = isSlotTier(campaign?.slotPricingTier) ? campaign!.slotPricingTier : 'standard';
  const used = await changesUsedThisMonth(campaignId);
  return { tier, used, remaining: contentChangesRemaining(tier, used), allowed: canChangeContent(tier, used) };
}
