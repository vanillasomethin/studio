import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Public-facing status. The internal onboarding stages collapse to two states:
 *  a screen is either playing, or it is on its way. */
export type StoreLocationStatus = 'live' | 'in_progress';

/** Slot-pricing tier — colours the public map's live pins. */
export type StoreLocationTier = 'standard' | 'growth' | 'flagship';

export type StoreLocation = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  status: StoreLocationStatus;
  tier: StoreLocationTier;
};

type Row = {
  id: string; storeName: string; locality: string | null;
  city: string | null; lat: number | null; lng: number | null;
  onboardingStage: string | null;
  slotPricingTier: string | null;
};

// Public endpoint — store name + location + whether it is live yet + tier.
//
// A store is public the moment it has a pin — registration, or the first GPS
// photo — and shows as "Coming soon" until it plays. Nothing waits for `live`,
// and nothing waits for ops either: the founder's rule is that a store onboarded
// with its GPS data appears on the map automatically. Only a rejected applicant
// is kept off.
//
// Raw SQL because onboardingStage and slotPricingTier post-date the init
// migration and may be absent on older databases; each missing column peels off
// one fallback layer, down to the original behaviour (every pinned store live,
// standard tier).
export async function GET() {
  let rows: Row[] = [];

  try {
    rows = await db.$queryRaw<Row[]>`
      SELECT "id", "storeName", "locality", "city", "lat", "lng", "onboardingStage", "slotPricingTier"
      FROM "Store"
      WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
      ORDER BY "createdAt" DESC
    `;
  } catch {
    try {
      const noTier = await db.$queryRaw<Omit<Row, 'slotPricingTier'>[]>`
        SELECT "id", "storeName", "locality", "city", "lat", "lng", "onboardingStage"
        FROM "Store"
        WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
        ORDER BY "createdAt" DESC
      `;
      rows = noTier.map((r) => ({ ...r, slotPricingTier: 'standard' }));
    } catch {
      try {
        const legacy = await db.$queryRaw<Omit<Row, 'onboardingStage' | 'slotPricingTier'>[]>`
          SELECT "id", "storeName", "locality", "city", "lat", "lng"
          FROM "Store"
          WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
          ORDER BY "createdAt" DESC
        `;
        rows = legacy.map((r) => ({ ...r, onboardingStage: 'live', slotPricingTier: 'standard' }));
      } catch {
        return NextResponse.json({ stores: [] });
      }
    }
  }

  const stores: StoreLocation[] = rows
    // A rejected applicant is not part of the network and must not be mapped.
    .filter((r) => r.onboardingStage !== 'rejected')
    .map(({ onboardingStage, slotPricingTier, ...r }) => ({
      ...r,
      status: onboardingStage === 'live' ? 'live' : 'in_progress',
      tier: slotPricingTier === 'growth' || slotPricingTier === 'flagship' ? slotPricingTier : 'standard',
    }));

  return NextResponse.json({ stores }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
