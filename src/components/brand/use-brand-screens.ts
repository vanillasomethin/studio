'use client';

// Shared loader for the onboarding screen list.
//
// The map picker and the tier directory render one above the other off the exact
// same query, so without this each would mount its own fetch of
// /api/brand/screens. In-flight requests are deduped per date; results are NOT
// cached — a later remount refetches, so availability never goes stale in a long
// onboarding session.

import { useEffect, useState } from 'react';
import type { SlotTier } from '@/lib/slot-pricing';

export type ScreenPin = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  /** Playing today. false = onboarded, screen not up yet ("Coming soon"). */
  live: boolean;
  slotStatus: 'available' | 'limited' | 'sold_out' | null;
  tier: SlotTier;
};

const inflight = new Map<string, Promise<ScreenPin[]>>();

function loadScreens(date: string): Promise<ScreenPin[]> {
  const hit = inflight.get(date);
  if (hit) return hit;
  const p = fetch(`/api/brand/screens?date=${encodeURIComponent(date)}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ screens: ScreenPin[] }>) : Promise.reject(new Error('screens'))))
    .then((d) => d.screens ?? [])
    .finally(() => { inflight.delete(date); });
  inflight.set(date, p);
  return p;
}

export function useBrandScreens(date: string) {
  const [pins, setPins] = useState<ScreenPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadScreens(date)
      .then((s) => { if (live) { setPins(s); setError(false); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [date]);

  return { pins, loading, error };
}
