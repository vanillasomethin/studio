// GET /api/admin/brands → { brands: { id, brandName, creativeCount }[] }
//
// The picker list behind Content's brand column and (later) the slot-mode creative
// chooser. Deliberately thin: brands are few and this is a dropdown, so it returns
// every brand in one shot rather than paginating.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const brands = await db.brand.findMany({
      select: {
        id:        true,
        brandName: true,
        // How many creatives this brand already owns — lets the picker show
        // "3 creatives" so an admin can tell a set-up brand from an empty one.
        _count: { select: { creatives: true } },
      },
      orderBy: { brandName: 'asc' },
    });

    return NextResponse.json({
      brands: brands.map((b) => ({
        id:            b.id,
        brandName:     b.brandName,
        creativeCount: b._count.creatives,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
