// POST /api/bills  — create a bill.
// Body: { billRef, storeName, items[], totalAmount, payMethod }
// Returns: { id, billRef }
//
// Auth: store partner — signed `x-store-token` header, or the next-auth session
// (see resolveStoreId in @/lib/store-partner-auth). FAILS CLOSED.
//
// The previous guard was `if (storeId) { ...check the row exists... }`, which was
// no guard at all in two independent ways: it was skipped entirely when the
// optional storeId was omitted, and even when supplied it only proved the store
// EXISTS. Store ids are publicly enumerable (CLAUDE.md states a bare storeId is
// not a credential), so anyone could forge POS bills against any real kirana
// store — visible on the public receipt page /bill/[billRef], claimable, and
// notifying that store's owner. billRef is @unique, so an attacker could also
// squat refs and make the store's genuine bill saves fail.
//
// storeId is now taken ONLY from the verified identity and never from the body.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withApiHandler } from '@/lib/with-api-handler';
import { resolveStoreId } from '@/lib/store-partner-auth';

// A real counter sale is a handful of lines; this only exists to stop an
// unbounded createMany from being a write-amplification lever.
const MAX_ITEMS = 200;

export const POST = withApiHandler('/api/bills', 'user', async (req: NextRequest) => {
  const { billRef, storeName, storeId, items, totalAmount, payMethod } = await req.json() as {
    billRef:     string;
    storeName:   string;
    storeId?:    string;
    items:       { name: string; qty: number; unit: string; price: number }[];
    totalAmount: number;
    payMethod:   string;
  };

  // Ownership FIRST, before any validation or DB work. An unauthenticated caller
  // should learn nothing about which payloads are well-formed, and should never
  // cost us a query. The body's storeId is passed only so resolveStoreId can
  // reject a mismatch against the token/session — it is never trusted on its own.
  const ownedStoreId = await resolveStoreId(storeId ?? null);
  if (!ownedStoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!billRef || !storeName || !items?.length) {
    return NextResponse.json({ error: 'billRef, storeName, items required' }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `A bill cannot have more than ${MAX_ITEMS} items` }, { status: 400 });
  }

  const bill = await db.$transaction(async (tx) => {
    const b = await tx.bill.create({
      data: {
        billRef,
        storeName,
        storeId:     ownedStoreId, // verified identity, never the client's claim
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
