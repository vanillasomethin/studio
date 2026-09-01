// PATCH /api/admin/products/[id] — update product fields or image URL
// DELETE /api/admin/products/[id] — soft-delete (isActive=false)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { id } = await params;
  const body = await req.json() as Partial<{
    productName: string; brand: string; sizeVariant: string;
    unitType: string; mrp: number | null; imageUrl: string | null;
    imageIsAi: boolean; mrpCheckedAt: string | null;
    barcodeEan: string | null; isActive: boolean;
  }>;

  const { mrpCheckedAt, ...rest } = body;

  const product = await db.product.update({
    where: { id },
    data:  {
      ...rest,
      ...(mrpCheckedAt !== undefined ? { mrpCheckedAt: mrpCheckedAt ? new Date(mrpCheckedAt) : null } : {}),
      updatedAt: new Date(),
    },
  });

  // Price and identity edits feed the shelf screens and the VoiceBill catalogue,
  // so record which fields moved rather than the whole body.
  await logAdminAction({
    actor, req,
    action: 'product.update',
    target: id,
    meta: {
      fields:   Object.keys(body),
      mrp:      body.mrp,
      isActive: body.isActive,
    },
  });

  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { id } = await params;
  await db.product.update({ where: { id }, data: { isActive: false } });

  await logAdminAction({ actor, req, action: 'product.delete', target: id, meta: { soft: true } });

  return NextResponse.json({ ok: true });
}
