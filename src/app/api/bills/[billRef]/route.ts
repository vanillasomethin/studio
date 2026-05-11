// GET /api/bills/[billRef]  — public, no auth
// Returns: { bill: {...}, items: [...] }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ billRef: string }> },
) {
  const { billRef } = await params;

  const bill = await db.bill.findUnique({
    where: { billRef },
    include: { items: true },
  });

  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { items, ...billData } = bill;
  return NextResponse.json({ bill: billData, items });
}
