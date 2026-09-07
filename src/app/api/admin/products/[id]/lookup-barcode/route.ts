// POST /api/admin/products/[id]/lookup-barcode
// Looks up this product's EAN barcode on Open Food Facts + Open Prices (free, no
// key). Returns verified product identity and any INR price candidates for admin
// review — does NOT auto-save the MRP.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lookupByBarcode } from '@/lib/openfoodfacts';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  if (!product.barcodeEan) {
    return NextResponse.json({ error: 'This product has no EAN barcode. Add one to enable lookup.' }, { status: 400 });
  }

  const result = await lookupByBarcode(product.barcodeEan);

  // Nothing is saved here — but this is an admin-triggered outbound call that
  // sends a catalogue barcode to a third party, so it is worth attributing.
  await logAdminAction({
    actor, req,
    action: 'product_barcode.lookup',
    target: id,
    meta:   { barcodeEan: product.barcodeEan },
  });

  return NextResponse.json(result);
}
