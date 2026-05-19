// PATCH /api/admin/products/[id] — update product fields or image URL
// DELETE /api/admin/products/[id] — soft-delete (isActive=false)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Partial<{
    productName: string; brand: string; sizeVariant: string;
    unitType: string; mrp: number | null; imageUrl: string | null;
    barcodeEan: string | null; isActive: boolean;
  }>;

  const product = await db.product.update({
    where: { id: params.id },
    data:  { ...body, updatedAt: new Date() },
  });

  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.product.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
