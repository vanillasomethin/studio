// POST /api/admin/products/[id]/generate-image
// Generates an AI product image (Gemini), uploads it to R2, and sets the product's
// imageUrl with imageIsAi=true. A real photograph uploaded later overrides it
// (the normal image-upload path sets imageIsAi=false).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { putObject, publicUrl } from '@/lib/r2';
import { generateProductImage } from '@/ai/flows/generate-product-image';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  try {
    const { dataUri } = await generateProductImage({
      productName: product.productName,
      brand:       product.brand,
      sizeVariant: product.sizeVariant,
      category:    product.category,
    });

    // dataUri: data:image/png;base64,XXXX
    const base64 = dataUri.split(',')[1];
    if (!base64) throw new Error('Malformed image data');
    const bytes = Buffer.from(base64, 'base64');

    const key = `products/${id}/ai.png`;
    await putObject(key, bytes, 'image/png');
    const url = `${publicUrl(key)}?v=${Date.now()}`; // cache-bust on regenerate

    const updated = await db.product.update({
      where: { id },
      data:  { imageUrl: url, imageIsAi: true, updatedAt: new Date() },
    });

    // An AI image overwrites what shoppers see on the shelf screen for this
    // product, so record who replaced it and with which asset.
    await logAdminAction({
      actor, req,
      action: 'product_image.generate',
      target: id,
      meta:   { productName: product.productName, brand: product.brand, imageUrl: url },
    });

    return NextResponse.json({ product: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Generation failed' }, { status: 500 });
  }
}
