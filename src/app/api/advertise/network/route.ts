// GET /api/advertise/network — real map pins for the /advertise store list.
//
// Unauthenticated by design, like /api/brand/screens: the advertiser page is
// public and this exposes strictly less than that route already does — a shop
// name the page already prints, and the pin the homepage map already shows.
//
// Why this exists: src/lib/advertise-network.ts carries a curated list of the
// stores we sell, with fallback coordinates so the map is never empty. The real
// pin is Store.lat/lng, surveyed at registration and corrected by ops. Rather
// than paste those numbers into the page — where they would start drifting the
// first time ops moved one — the page asks for them here and merges them over
// its fallbacks.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NETWORK_STORES, isPlottablePin, storeMatchKey } from '@/lib/advertise-network';

export type NetworkPin = { lat: number; lng: number };

export async function GET() {
  const pins: Record<string, NetworkPin> = {};

  try {
    // Every pinned store at any stage but rejected — the same rule the public
    // store map follows. Nothing waits for `live`.
    const rows = await db.store.findMany({
      where: { lat: { not: null }, lng: { not: null }, NOT: { onboardingStage: 'rejected' } },
      select: { storeName: true, lat: true, lng: true },
    });

    const byKey = new Map<string, NetworkPin>();
    for (const row of rows) {
      if (!isPlottablePin(row.lat, row.lng)) continue;
      const key = storeMatchKey(row.storeName);
      // First match wins. Two shops normalising to one key is an ops data
      // problem; picking a different one on each request would be worse.
      if (!byKey.has(key)) byKey.set(key, { lat: row.lat as number, lng: row.lng as number });
    }

    for (const store of NETWORK_STORES) {
      const hit = byKey.get(storeMatchKey(store.name));
      if (hit) pins[store.id] = hit;
    }
  } catch {
    // A database blip must leave the page on its fallback coordinates, not blank
    // the map. An empty object is exactly that.
    return NextResponse.json({ pins: {}, matched: 0, total: NETWORK_STORES.length });
  }

  return NextResponse.json({ pins, matched: Object.keys(pins).length, total: NETWORK_STORES.length });
}
