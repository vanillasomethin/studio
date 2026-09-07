// Monthly creative-change quota by plan tier — pure. DB-bound counterpart:
// content-quota-db.ts (counts this month's changes from AuditLog).

import type { SlotTier } from './slot-pricing';

// null = unlimited
export const CONTENT_CHANGE_QUOTA: Record<SlotTier, number | null> = {
  standard: 1,
  growth: 3,
  flagship: null,
};

export function contentChangesRemaining(tier: SlotTier, usedThisMonth: number): number | null {
  const quota = CONTENT_CHANGE_QUOTA[tier];
  if (quota == null) return null; // unlimited
  return Math.max(0, quota - usedThisMonth);
}

export function canChangeContent(tier: SlotTier, usedThisMonth: number): boolean {
  const remaining = contentChangesRemaining(tier, usedThisMonth);
  return remaining == null || remaining > 0;
}
