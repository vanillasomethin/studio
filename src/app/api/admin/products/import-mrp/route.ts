// POST /api/admin/products/import-mrp
// Bulk-updates MRP on EXISTING products from a pasted/uploaded list — the highest-
// leverage MRP source, since admin already receives distributor price lists (Excel/
// PDF) that map a product to its MRP. Each row keys on either the ALIVE product id
// (CAT-BRAND-SEQ) or the EAN barcode. Sets mrp + mrpCheckedAt; never creates rows.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ImportRow = { key: string; mrp: number };

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json() as { rows?: ImportRow[] };
  const rows = (body.rows ?? []).filter((r) => r.key?.trim() && Number.isFinite(r.mrp) && r.mrp > 0);
  if (!rows.length) return NextResponse.json({ error: 'No valid rows' }, { status: 400 });

  const now = new Date();
  let updated = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    const key = row.key.trim();
    const mrp = Math.round(row.mrp);
    // Match by product id first, then by EAN barcode.
    const product = await db.product.findFirst({
      where: { isActive: true, OR: [{ id: key }, { barcodeEan: key }] },
      select: { id: true },
    });
    if (!product) { notFound.push(key); continue; }
    await db.product.update({
      where: { id: product.id },
      data:  { mrp, mrpCheckedAt: now, updatedAt: now },
    });
    updated++;
  }

  // Bulk price edit across the catalogue — no single target id, so the counts
  // are the record. Wrong MRPs are what shoppers see on screen, so who ran the
  // import matters as much as the numbers.
  await logAdminAction({
    actor, req,
    action: 'product.import_mrp',
    meta:   { total: rows.length, updated, notFoundCount: notFound.length },
  });

  return NextResponse.json({ updated, notFound, total: rows.length });
}
