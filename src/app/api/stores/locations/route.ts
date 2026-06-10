import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export type StoreLocation = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  status: 'live';
};

// Public endpoint — returns only store name + location for the map.
// Uses raw SQL to avoid schema drift issues (onboardingStage etc.).
export async function GET() {
  try {
    const rows = await db.$queryRaw<Array<{
      id: string; storeName: string; locality: string | null;
      city: string | null; lat: number | null; lng: number | null;
    }>>`
      SELECT "id", "storeName", "locality", "city", "lat", "lng"
      FROM "Store"
      WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
      ORDER BY "createdAt" DESC
    `;

    const stores: StoreLocation[] = rows.map((r) => ({ ...r, status: 'live' as const }));
    return NextResponse.json({ stores }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  } catch {
    return NextResponse.json({ stores: [] });
  }
}
