// Fuzzy product search for store offer entry.
// GET /api/products/search?q=<name>&size=<sizeVariant>&limit=5
// Returns top matches with confidence score for the offer-entry UI.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function similarity(a: string, b: string): number {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  // token overlap
  const ta = new Set(a.split(/\s+/));
  const tb = new Set(b.split(/\s+/));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}

export async function GET(req: NextRequest) {
  const p     = req.nextUrl.searchParams;
  const q     = p.get('q')?.trim() ?? '';
  const size  = p.get('size')?.trim() ?? '';
  const limit = Math.min(Number(p.get('limit') ?? 5), 10);

  if (!q) return NextResponse.json({ results: [] });

  // Broad DB search — we'll rank client-side
  const candidates = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { productName: { contains: q.split(' ')[0], mode: 'insensitive' } },
        { brand:       { contains: q.split(' ')[0], mode: 'insensitive' } },
      ],
    },
    take: 50,
  });

  const scored = candidates.map((p) => {
    const nameScore = similarity(q, p.productName);
    const sizeScore = size ? similarity(size, p.sizeVariant) * 0.4 : 0;
    return { product: p, confidence: Math.min(1, nameScore + sizeScore) };
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  const top = scored.slice(0, limit);

  return NextResponse.json({ results: top });
}
