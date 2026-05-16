// GET  /api/stores/offers  — list my store's offers
// POST /api/stores/offers  — create an offer
// Auth: store session required

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function getStore(userId: string) {
  return db.store.findUnique({ where: { userId } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await getStore(session.user.id);
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const offers = await db.storeOffer.findMany({
    where:   { storeId: store.id, active: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(offers.map((o) => ({
    ...o,
    createdAt:  o.createdAt.toISOString(),
    updatedAt:  o.updatedAt.toISOString(),
    validUntil: o.validUntil?.toISOString() ?? null,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await getStore(session.user.id);
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { productName, weight, mrp, offerPrice, validUntil } = await req.json() as {
    productName: string; weight?: string;
    mrp: number; offerPrice: number; validUntil?: string;
  };

  if (!productName?.trim()) return NextResponse.json({ error: 'Product name required' }, { status: 400 });
  if (!mrp || !offerPrice)  return NextResponse.json({ error: 'MRP and offer price required' }, { status: 400 });
  if (offerPrice >= mrp)    return NextResponse.json({ error: 'Offer price must be less than MRP' }, { status: 400 });

  const offer = await db.storeOffer.create({
    data: {
      storeId:     store.id,
      productName: productName.trim(),
      weight:      weight?.trim() || null,
      mrp:         Math.round(mrp),
      offerPrice:  Math.round(offerPrice),
      validUntil:  validUntil ? new Date(validUntil) : null,
    },
  });

  return NextResponse.json({
    ...offer,
    createdAt:  offer.createdAt.toISOString(),
    updatedAt:  offer.updatedAt.toISOString(),
    validUntil: offer.validUntil?.toISOString() ?? null,
  });
}
