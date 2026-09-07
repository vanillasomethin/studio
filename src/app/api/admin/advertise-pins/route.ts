// GET /api/admin/advertise-pins — which /advertise map pins are real (admin)
// Auth: requireAdmin — admin/ops session.
//
// The advertiser page draws each store at its surveyed Store.lat/lng when it can
// find one, and falls back to an approximate coordinate when it cannot. That
// fallback is silent by design — a brand should never see a blank map — which
// means a shop can sit on the wrong corner for months and nobody would know.
// This is the panel that makes the gap visible, and says what to do about each.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { NETWORK_STORES, isPlottablePin, storeMatchKey } from '@/lib/advertise-network';

/** Why a curated store is, or is not, showing its real location. */
export type PinStatus =
  /** A pinned, non-rejected store matched by name. The map shows the real spot. */
  | 'matched'
  /** No store registered under a name that matches. */
  | 'no-store'
  /** Registered, but nobody has set a map pin yet. */
  | 'no-pin'
  /** Registered and pinned, but the pin is 0,0 or out of range. */
  | 'bad-pin'
  /** The only store matching this name was rejected — it should not be on sale. */
  | 'rejected';

export type PinRow = {
  id: string;
  name: string;
  tier: string;
  status: PinStatus;
  /** The Store row behind a match, so ops can find it in the list below. */
  storeName: string | null;
};

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const rows = await db.store.findMany({
    select: { storeName: true, lat: true, lng: true, onboardingStage: true },
  });

  // Group by match key: one curated name can have several candidate rows (a
  // duplicate registration, a rejected first attempt), and the reason we report
  // has to consider all of them, not just whichever came back first.
  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = storeMatchKey(row.storeName);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }

  const stores: PinRow[] = NETWORK_STORES.map(store => {
    const candidates = byKey.get(storeMatchKey(store.name)) ?? [];
    const base = { id: store.id, name: store.name, tier: store.tier };

    if (candidates.length === 0) return { ...base, status: 'no-store', storeName: null };

    const usable = candidates.filter(c => c.onboardingStage !== 'rejected');
    if (usable.length === 0) {
      return { ...base, status: 'rejected', storeName: candidates[0].storeName };
    }

    // Same order of preference the public route resolves in, so this panel can
    // never claim a pin the page isn't actually drawing.
    const pinned = usable.find(c => isPlottablePin(c.lat, c.lng));
    if (pinned) return { ...base, status: 'matched', storeName: pinned.storeName };

    const unset = usable.find(c => c.lat == null || c.lng == null);
    if (unset) return { ...base, status: 'no-pin', storeName: unset.storeName };

    return { ...base, status: 'bad-pin', storeName: usable[0].storeName };
  });

  return NextResponse.json({
    stores,
    total: stores.length,
    matched: stores.filter(s => s.status === 'matched').length,
  });
}
