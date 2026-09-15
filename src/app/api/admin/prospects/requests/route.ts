// GET /api/admin/prospects/requests?prospectId=… — the brand-interest leads a
// "Potential" pin on /advertise has collected (see /api/advertise/prospect-request,
// the public write side of this). Admin-only, same as every other prospect route.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const prospectId = req.nextUrl.searchParams.get('prospectId')?.trim();
  if (!prospectId) return NextResponse.json({ error: 'prospectId required' }, { status: 400 });

  const requests = await db.prospectRequest.findMany({
    where: { prospectId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    requests: requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}
