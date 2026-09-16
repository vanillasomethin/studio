// GET /api/advertise/prospects — public "potential store" pins for /advertise's
// network map.
//
// Deliberate, documented exception to ProspectLocation's usual admin-only rule
// (see CLAUDE.md's Store map pin section): a brand looking at the network map
// can see where ALIVE is scouting and ask to have a spot onboarded, via
// POST /api/advertise/prospect-request. Same fidelity as a live store pin —
// real name, real coordinates — but nothing else: no notes, no owner name, no
// phone. `rejected` (dead end) and `converted` (already a real Store, shown
// via /api/stores/locations instead) are excluded so nobody sees a stage that
// isn't "still worth asking about".

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export type PotentialStore = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  locality: string | null;
  city: string | null;
};

export async function GET() {
  try {
    const rows = await db.prospectLocation.findMany({
      where: { status: { notIn: ['rejected', 'converted'] } },
      select: { id: true, label: true, lat: true, lng: true, locality: true, city: true },
      orderBy: { createdAt: 'desc' },
    });
    const prospects: PotentialStore[] = rows;
    return NextResponse.json({ prospects }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  } catch {
    return NextResponse.json({ prospects: [] });
  }
}
