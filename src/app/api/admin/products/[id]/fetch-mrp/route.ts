// POST /api/admin/products/[id]/fetch-mrp
// Scrapes Amazon India + Flipkart (via a self-hosted Maxun instance) for MRP
// candidates matching this product. Returns candidates for admin review — does
// NOT auto-save, because scraped prices are noisy and need a human to confirm.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchMrpCandidates } from '@/lib/maxun';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST, but nothing is written: this only returns scrape candidates for review
// (the save happens on the products route), so there is no mutation to audit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const query = [product.brand, product.productName, product.sizeVariant]
    .filter(Boolean)
    .join(' ')
    .trim();

  try {
    const { candidates, errors } = await fetchMrpCandidates(query);
    return NextResponse.json({ query, candidates, errors });
  } catch (err) {
    const msg = (err as Error).message ?? 'Fetch failed';
    const status = msg.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
