import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await db.store.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const payments = await db.storePayment.findMany({
    where: { storeId: store.id },
    select: { month: true, status: true, amountPaise: true, paidAt: true, payRef: true },
    orderBy: { month: 'asc' },
  });
  return NextResponse.json(payments);
}
