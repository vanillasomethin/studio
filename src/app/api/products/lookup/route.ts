// GET /api/products/lookup?ean=1234567890123
// Public — used by VoiceBill barcode scanner (no admin auth needed)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const ean = req.nextUrl.searchParams.get('ean')?.trim();
  if (!ean) return NextResponse.json({ error: 'ean required' }, { status: 400 });

  const product = await db.product.findFirst({
    where: { barcodeEan: ean, isActive: true },
    select: {
      id:          true,
      productName: true,
      brand:       true,
      sizeVariant: true,
      unitType:    true,
      mrp:         true,
    },
  });

  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(product);
}
