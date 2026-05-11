// GET /api/customer/bills?phone=X&token=Y  — lightweight token auth
// Returns: { customer: { name, phone }, bills: [...] }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? '';
  const token = req.nextUrl.searchParams.get('token') ?? '';

  if (!phone || !token) {
    return NextResponse.json({ error: 'phone and token required' }, { status: 400 });
  }

  const customer = await db.customer.findUnique({ where: { phone } });
  if (!customer || customer.token !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bills = await db.bill.findMany({
    where:   { customerId: customer.id },
    include: { items: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    customer: { name: customer.name, phone: customer.phone },
    bills: bills.map(({ items, ...b }) => ({ ...b, itemCount: items.length })),
  });
}
