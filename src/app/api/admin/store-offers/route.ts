import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

// GET /api/admin/store-offers?storeId=xxx — list a store's active offers, for flyer generation
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const storeId = req.nextUrl.searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 });

  const offers = await db.storeOffer.findMany({
    where:   { storeId, active: true },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { imageUrl: true } } },
  });

  return NextResponse.json(offers.map((o) => ({
    id:              o.id,
    productName:     o.productName,
    weight:          o.weight,
    mrp:             o.mrp,
    offerPrice:      o.offerPrice,
    productImageUrl: o.product?.imageUrl ?? null,
    validUntil:      o.validUntil?.toISOString() ?? null,
  })));
}
