import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = await db.store.findUnique({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  return NextResponse.json(store);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    email?: string;
    payoutMethod?: string; upiId?: string;
    bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
  };

  if (body.email !== undefined) {
    if (!body.email?.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    await db.user.update({ where: { id: session.user.id }, data: { email: body.email } });
  }

  if (body.payoutMethod !== undefined) {
    await db.store.update({
      where: { userId: session.user.id },
      data: {
        payoutMethod:    body.payoutMethod    || null,
        upiId:           body.upiId           || null,
        bankAccountName: body.bankAccountName || null,
        bankAccountNo:   body.bankAccountNo   || null,
        bankIfsc:        body.bankIfsc        || null,
        bankName:        body.bankName        || null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
