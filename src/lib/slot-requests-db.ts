// DB-bound counterpart to slot-windows.ts — credit balance and the request lifecycle.
//
// A campaign's credit pool is its Campaign.screens count (the "initial selection" made
// at signup, reused as the self-serve booking allowance — no separate purchase flow).
// Pending AND approved requests both hold credits reserved; only rejected/cancelled
// release them back. Approving a request does NOT create a SlotBooking — that stays a
// deliberate admin action in the existing slot-loop grid (see slots-tab.tsx /
// /api/slots/bookings) once they've picked the exact position; this table is purely
// the brand-facing intake + credit ledger layered on top.

import { db } from './db';
import { creditCostForWindow, isWindowId } from './slot-windows';
import { notifyAdminWA } from './notify';

export type CreditBalance = { granted: number; consumed: number; available: number };

export async function getCreditBalance(campaignId: string): Promise<CreditBalance> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { screens: true } });
  const granted = campaign?.screens ?? 0;
  const held = await db.slotRequest.findMany({
    where: { campaignId, status: { in: ['pending', 'approved'] } },
    select: { creditsCost: true },
  });
  const consumed = held.reduce((sum, r) => sum + r.creditsCost, 0);
  return { granted, consumed, available: Math.max(0, granted - consumed) };
}

export type CreateRequestResult =
  | { ok: true; id: string; creditsCost: number }
  | { ok: false; error: string };

export async function createSlotRequest(args: {
  campaignId: string; storeId: string; window: string; note?: string | null;
}): Promise<CreateRequestResult> {
  if (!isWindowId(args.window)) return { ok: false, error: 'Invalid time window' };

  const store = await db.store.findUnique({ where: { id: args.storeId }, select: { id: true, storeName: true, loopSlotCount: true } });
  if (!store) return { ok: false, error: 'Store not found' };
  if (store.loopSlotCount == null) return { ok: false, error: 'This store is not in slot mode' };

  const creditsCost = creditCostForWindow(args.window);
  const balance = await getCreditBalance(args.campaignId);
  if (balance.available < creditsCost) {
    return { ok: false, error: `Not enough credits — this window needs ${creditsCost}, you have ${balance.available} available.` };
  }

  const request = await db.slotRequest.create({
    data: { campaignId: args.campaignId, storeId: args.storeId, window: args.window, creditsCost, note: args.note?.trim() || null },
  });

  const campaign = await db.campaign.findUnique({ where: { id: args.campaignId }, select: { name: true } });
  void notifyAdminWA(
    `New slot request: ${campaign?.name ?? args.campaignId} wants ${args.window} at ${store.storeName}. Review in Admin → Slot inventory.`,
  );

  return { ok: true, id: request.id, creditsCost };
}

/** Cancel a still-pending request the campaign owns — releases its held credits. */
export async function cancelSlotRequest(id: string, campaignId: string): Promise<boolean> {
  const result = await db.slotRequest.updateMany({
    where: { id, campaignId, status: 'pending' },
    data: { status: 'cancelled', decidedAt: new Date() },
  });
  return result.count > 0;
}

export async function decideSlotRequest(
  id: string, decision: 'approved' | 'rejected', decidedBy: string | null,
): Promise<boolean> {
  const result = await db.slotRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: decision, decidedAt: new Date(), decidedBy },
  });
  return result.count > 0;
}
