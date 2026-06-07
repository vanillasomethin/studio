// POST /api/admin/products/[id]/generate-video
// Renders an animated ALIVE offer video for this product via Remotion Lambda and
// returns the video URL. Admin-only. Returns 503 until Remotion Lambda is set up.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { renderOfferVideo } from '@/lib/remotion-render';

export const runtime = 'nodejs';
export const maxDuration = 120;

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // Optional caller overrides (e.g. a custom offer line) without touching the product.
  const body = await req.json().catch(() => ({})) as { offerText?: string };

  try {
    const url = await renderOfferVideo({
      productName: product.productName,
      brand:       product.brand,
      sizeVariant: product.sizeVariant || undefined,
      price:       product.mrp,
      offerText:   body.offerText?.trim() || "TODAY'S OFFER",
      imageUrl:    product.imageUrl || undefined,
      accent:      '#ef4444',
    });
    return NextResponse.json({ url });
  } catch (err) {
    const msg = (err as Error).message ?? 'Render failed';
    const status = msg.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
