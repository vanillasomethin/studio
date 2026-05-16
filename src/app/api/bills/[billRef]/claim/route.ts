// POST /api/bills/[billRef]/claim  — no auth
// Body: { phone, name }
// Returns: { token, name, phone }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { notifyStoreWA, billClaimedMsg } from '@/lib/notify';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ billRef: string }> },
) {
  const { billRef } = await params;

  try {
    const { phone, name } = await req.json() as { phone: string; name: string };

    if (!phone?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'phone and name required' }, { status: 400 });
    }

    const bill = await db.bill.findUnique({ where: { billRef } });
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

    const customer = await db.customer.upsert({
      where:  { phone },
      create: { phone, name, token: randomUUID() },
      update: {},
    });

    const updated = await db.bill.update({
      where:   { billRef },
      data:    { customerId: customer.id },
      include: { store: { select: { whatsapp: true } } },
    });

    // Notify store owner (non-fatal)
    if (updated.store?.whatsapp) {
      void notifyStoreWA(updated.store.whatsapp, billClaimedMsg(
        updated.storeName, customer.name, customer.phone, billRef,
      ));
    }

    return NextResponse.json({ token: customer.token, name: customer.name, phone: customer.phone });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
