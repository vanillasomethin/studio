import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Public-facing status. The internal onboarding stages collapse to two states:
 *  a screen is either playing, or it is on its way. */
export type StoreLocationStatus = 'live' | 'in_progress';

export type StoreLocation = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  status: StoreLocationStatus;
};

type Row = {
  id: string; storeName: string; locality: string | null;
  city: string | null; lat: number | null; lng: number | null;
  onboardingStage: string | null;
};

// Public endpoint — store name + location + whether it is live yet.
// Raw SQL because onboardingStage post-dates the init migration and may be
// absent on older databases; if the column isn't there we fall back to treating
// every pinned store as live, which is how this endpoint behaved before.
export async function GET() {
  let rows: Row[] = [];

  try {
    rows = await db.$queryRaw<Row[]>`
      SELECT "id", "storeName", "locality", "city", "lat", "lng", "onboardingStage"
      FROM "Store"
      WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
      ORDER BY "createdAt" DESC
    `;
  } catch {
    try {
      const legacy = await db.$queryRaw<Omit<Row, 'onboardingStage'>[]>`
        SELECT "id", "storeName", "locality", "city", "lat", "lng"
        FROM "Store"
        WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
        ORDER BY "createdAt" DESC
      `;
      rows = legacy.map((r) => ({ ...r, onboardingStage: 'live' }));
    } catch {
      return NextResponse.json({ stores: [] });
    }
  }

  const stores: StoreLocation[] = rows
    // A rejected applicant is not part of the network and must not be mapped.
    .filter((r) => r.onboardingStage !== 'rejected')
    .map(({ onboardingStage, ...r }) => ({
      ...r,
      status: onboardingStage === 'live' ? 'live' : 'in_progress',
    }));

  return NextResponse.json({ stores }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
