// DB-bound counterpart to addons.ts — purchases Peak Boost / Sound Ad add-ons and
// resolves the per-store state the device/plan route and brand dashboard need.

import { db } from './db';
import { decideAddonStatus, type AddonStatus, type AddonType } from './addons';
import { slotSpanForDuration } from './slots';

export type PurchaseResult = { status: AddonStatus } | { error: string };

/** FCFS purchase: counts already-active add-ons of this type at the store, decides
 *  active vs waitlisted against the cap, and creates the row. The unique
 *  (storeId, campaignId, type) constraint makes a double-purchase a clean no-op read
 *  of the existing row rather than a duplicate. */
export async function purchaseAddon(storeId: string, campaignId: string, type: AddonType): Promise<PurchaseResult> {
  const existing = await db.slotAddon.findUnique({
    where: { storeId_campaignId_type: { storeId, campaignId, type } },
  });
  if (existing) return { status: existing.status as AddonStatus };

  const booked = await db.slotBooking.findFirst({ where: { storeId, campaignId }, select: { id: true } });
  if (!booked) return { error: 'This campaign has no booked slot at that store yet.' };

  // Peak Boost works by biasing the single-slot bonus round-robin, and multi-slot
  // campaigns are excluded from that pool by construction (a 30s creative cannot
  // fill one scattered 10s empty). Selling them the boost would charge for
  // something provably inert — refuse instead.
  if (type === 'peak_boost') {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        slotContent: { select: { durationMs: true } },
        slotPlaylist: { select: { items: {
          where: { contentId: { not: null } },
          select: { content: { select: { durationMs: true } } },
        } } },
      },
    });
    const durations = campaign?.slotPlaylist?.items.length
      ? campaign.slotPlaylist.items.map((i) => i.content?.durationMs ?? null)
      : [campaign?.slotContent?.durationMs ?? null];
    if (durations.some((d) => slotSpanForDuration(d) > 1)) {
      return { error: 'Peak Boost multiplies 10-second bonus plays — it has no effect on longer multi-slot ads, so it cannot be added to this campaign.' };
    }
  }

  const activeCount = await db.slotAddon.count({ where: { storeId, type, status: 'active' } });
  const status = decideAddonStatus(activeCount, type);

  const created = await db.slotAddon.create({
    data: { storeId, campaignId, type, status },
  }).catch(() => null); // unique-constraint race — fall through to re-read below

  if (created) return { status: created.status as AddonStatus };
  const raced = await db.slotAddon.findUnique({
    where: { storeId_campaignId_type: { storeId, campaignId, type } },
  });
  return raced ? { status: raced.status as AddonStatus } : { error: 'Could not add — please retry.' };
}

export type StoreAddonState = {
  storeId: string;
  storeName: string;
  peakBoost: { status: AddonStatus | 'none'; activeCount: number };
  soundAd:   { status: AddonStatus | 'none'; takenByOther: boolean };
};

/** Every store this campaign has a slot booking at, with this campaign's add-on
 *  status (or 'none') and enough store-wide context to render cap/waitlist state. */
export async function getCampaignAddonState(campaignId: string): Promise<StoreAddonState[]> {
  const bookings = await db.slotBooking.findMany({
    where: { campaignId }, select: { storeId: true }, distinct: ['storeId'],
  });
  if (bookings.length === 0) return [];
  const storeIds = bookings.map((b) => b.storeId);

  const [stores, mine, activePeak, activeSound] = await Promise.all([
    db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, storeName: true } }),
    db.slotAddon.findMany({ where: { storeId: { in: storeIds }, campaignId } }),
    db.slotAddon.findMany({ where: { storeId: { in: storeIds }, type: 'peak_boost', status: 'active' } }),
    db.slotAddon.findMany({ where: { storeId: { in: storeIds }, type: 'sound_ad', status: 'active' } }),
  ]);

  const mineByStore = new Map<string, Map<string, AddonStatus>>();
  for (const a of mine) {
    const m = mineByStore.get(a.storeId) ?? new Map();
    m.set(a.type, a.status as AddonStatus);
    mineByStore.set(a.storeId, m);
  }
  const peakCountByStore = new Map<string, number>();
  for (const a of activePeak) peakCountByStore.set(a.storeId, (peakCountByStore.get(a.storeId) ?? 0) + 1);
  const soundTakenByStore = new Map<string, string>(); // storeId -> campaignId holding it
  for (const a of activeSound) soundTakenByStore.set(a.storeId, a.campaignId);

  return stores.map((s) => {
    const mineHere = mineByStore.get(s.id);
    const soundHolder = soundTakenByStore.get(s.id);
    return {
      storeId: s.id,
      storeName: s.storeName,
      peakBoost: { status: mineHere?.get('peak_boost') ?? 'none', activeCount: peakCountByStore.get(s.id) ?? 0 },
      soundAd: {
        status: mineHere?.get('sound_ad') ?? 'none',
        takenByOther: !!soundHolder && soundHolder !== campaignId,
      },
    };
  });
}

/** Active Peak-Boosted campaignIds at a store, for the device/plan route's pool
 *  weighting. Only meaningful during a peak window — callers gate on that. */
export async function getPeakBoostedCampaignIds(storeId: string): Promise<Set<string>> {
  const rows = await db.slotAddon.findMany({
    where: { storeId, type: 'peak_boost', status: 'active' }, select: { campaignId: true },
  });
  return new Set(rows.map((r) => r.campaignId));
}

/** The campaignId holding the active Sound Ad slot at a store, if any. */
export async function getSoundAdCampaignId(storeId: string): Promise<string | null> {
  const row = await db.slotAddon.findFirst({
    where: { storeId, type: 'sound_ad', status: 'active' }, select: { campaignId: true },
  });
  return row?.campaignId ?? null;
}
