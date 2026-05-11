// POST /api/bills  — create a bill (store auth required)
// Body: { billRef, storeName, storeId?, items[], totalAmount, payMethod }
// Returns: { id, billRef }

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
