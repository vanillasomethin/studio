// GET /api/brand/screens?date=YYYY-MM-DD — onboarded screens for the onboarding
// map picker; `live` says whether a screen is playing today. Stores that are
// physically onboarded but not yet live are included so a brand can see where
// the network is growing — the picker shows them as "Coming soon", not bookable.
// Unauthenticated by design, like /api/brand/slot-availability: the booking flow is
// public, so this answers pre-auth. It exposes only what a buyer needs to pick a
// screen — name, locality, coordinates, and a coarse availability status for the
// campaign's start date. Per-store sold counts and owner details stay behind the
// admin-only routes.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { istToday } from '@/lib/slots';
import { availabilityGrid } from '@/lib/slots-db';

const LIMITED_THRESHOLD = 0.7; // ≥70% of the store's loop sold → "limited"

export type ScreenPin = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  // Playing today. false = onboarded but not live yet: shown as "Coming soon",
  // not selectable.
  live: boolean;
  // 'available' | 'limited' | 'sold_out' — slot inventory on the requested date.
  // null = store isn't slot-managed (schedule mode) or is closed that day; ops
  // can still schedule it, so the picker treats null as selectable.
  slotStatus: 'available' | 'limited' | 'sold_out' | null;
};

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') ?? istToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const rows = await db.store.findMany({
      where: {
        lat: { not: null }, lng: { not: null },
        OR: [
          { liveAt: { not: null } },
          { onboardingStage: { in: ['physically_onboarded', 'digitally_onboarded', 'live'] } },
        ],
      },
      select: {
        id: true, storeName: true, locality: true, city: true,
        lat: true, lng: true, liveAt: true, onboardingStage: true,
        loopSlotCount: true, openDays: true,
      },
    });
    // Leaflet throws on a bad LatLng, and one bad row would take the picker
    // down for every brand — so a pin that isn't a real point is dropped here.
    const stores = rows.filter((s) =>
      Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat!) <= 90 && Math.abs(s.lng!) <= 180,
    );

    const slotManaged = stores.filter((s) => s.loopSlotCount != null);
    const grid = slotManaged.length
      ? await availabilityGrid(
          slotManaged.map((s) => ({ id: s.id, openDays: s.openDays, loopSlotCount: s.loopSlotCount! })),
          [date],
        )
      : new Map<string, Map<string, number | null>>();

    const screens: ScreenPin[] = stores.map((s) => {
      let slotStatus: ScreenPin['slotStatus'] = null;
      if (s.loopSlotCount != null) {
        const sold = grid.get(s.id)?.get(date);
        if (sold != null) {
          slotStatus =
            sold >= s.loopSlotCount                  ? 'sold_out'
            : sold / s.loopSlotCount >= LIMITED_THRESHOLD ? 'limited'
            :                                          'available';
        }
      }
      return {
        id: s.id, storeName: s.storeName, locality: s.locality, city: s.city,
        lat: s.lat!, lng: s.lng!,
        live: s.liveAt != null || s.onboardingStage === 'live',
        slotStatus,
      };
    });

    return NextResponse.json({ date, screens });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
