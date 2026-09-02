// DB-bound counterpart to slot-pricing.ts — resolves today's filled-slot count and
// the resulting store payout, single-store and batched.

import { db } from './db';
import { istToday } from './slots';
import { isSlotTier, storeSlotPayoutPaise, type SlotTier } from './slot-pricing';

/** Distinct campaigns currently occupying this store's loop today — the same
 *  "filled" definition used for pricing and for the store's own occupancy display. */
export async function filledSlotCount(storeId: string, today: string = istToday()): Promise<number> {
  const rows = await db.slotBooking.findMany({
    where: { storeId, date: new Date(`${today}T00:00:00Z`) },
    select: { campaignId: true },
    distinct: ['campaignId'],
  });
  return rows.length;
}

/** The monthly payout figure a store should see/claim. Flat-rate (non-slot) stores
 *  are untouched — this only takes over once a store is in slot mode. */
export async function computeStoreMonthlyPayoutPaise(storeId: string): Promise<number> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { loopSlotCount: true, slotPricingTier: true, monthlyCompensationPaise: true },
  });
  if (!store) return 50_000;
  if (store.loopSlotCount == null) return store.monthlyCompensationPaise;

  const tier: SlotTier = isSlotTier(store.slotPricingTier) ? store.slotPricingTier : 'standard';
  const filled = await filledSlotCount(storeId);
  return storeSlotPayoutPaise(tier, filled);
}

/** Same as computeStoreMonthlyPayoutPaise, batched for a store list (admin fleet view)
 *  — one grouped query for every slot-mode store's fill count instead of N queries. */
export async function computeStoreMonthlyPayoutPaiseBatch(
  stores: { id: string; loopSlotCount: number | null; slotPricingTier: string; monthlyCompensationPaise: number }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const s of stores) {
    if (s.loopSlotCount == null) result.set(s.id, s.monthlyCompensationPaise);
  }
  const slotStores = stores.filter((s) => s.loopSlotCount != null);
  if (slotStores.length === 0) return result;

  const today = istToday();
  const rows = await db.slotBooking.findMany({
    where: { storeId: { in: slotStores.map((s) => s.id) }, date: new Date(`${today}T00:00:00Z`) },
    select: { storeId: true, campaignId: true },
    distinct: ['storeId', 'campaignId'],
  });
  const filledByStore = new Map<string, number>();
  for (const r of rows) filledByStore.set(r.storeId, (filledByStore.get(r.storeId) ?? 0) + 1);

  for (const s of slotStores) {
    const tier: SlotTier = isSlotTier(s.slotPricingTier) ? s.slotPricingTier : 'standard';
    result.set(s.id, storeSlotPayoutPaise(tier, filledByStore.get(s.id) ?? 0));
  }
  return result;
}
