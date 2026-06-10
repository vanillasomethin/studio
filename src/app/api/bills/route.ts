// POST /api/bills  — create a bill (store auth: storeId must exist in DB)
// Body: { billRef, storeName, storeId?, items[], totalAmount, payMethod }
// Returns: { id, billRef }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withApiHandler } from '@/lib/with-api-handler';

export const POST = withApiHandler('/api/bills', 'user', async (req: NextRequest) => {
  const { billRef, storeName, storeId, items, totalAmount, payMethod } = await req.json() as {
    billRef:     string;
    storeName:   string;
    storeId?:    string;
    items:       { name: string; qty: number; unit: string; price: number }[];
    totalAmount: number;
    payMethod:   string;
  };

  if (!billRef || !storeName || !items?.length) {
    return NextResponse.json({ error: 'billRef, storeName, items required' }, { status: 400 });
  }

  // Validate storeId if provided — prevents anonymous bill creation
  if (storeId) {
    const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) return NextResponse.json({ error: 'Invalid storeId' }, { status: 403 });
  }

  const bill = await db.$transaction(async (tx) => {
    const b = await tx.bill.create({
      data: {
        billRef,
        storeName,
        storeId:     storeId ?? null,
        totalAmount: Math.round(totalAmount),
        payMethod:   payMethod ?? 'cash',
        status:      'open',
      },
    });
    await tx.billItem.createMany({
      data: items.map((i) => ({
        billId: b.id,
        name:   i.name,
        qty:    i.qty,
        unit:   i.unit ?? 'pcs',
        price:  Math.round(i.price),
      })),
    });
    return b;
  });

  return NextResponse.json({ id: bill.id, billRef: bill.billRef });
});
