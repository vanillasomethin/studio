import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = await db.store.findUnique({
    where: { userId: session.user.id },
  });

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  return NextResponse.json(store);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json() as {
      payoutMethod?: string; upiId?: string; bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
    };
    const store = await db.store.update({
      where: { userId: session.user.id },
      data: {
        payoutMethod: body.payoutMethod || null,
        upiId: body.upiId || null,
        bankAccountName: body.bankAccountName || null,
        bankAccountNo: body.bankAccountNo || null,
        bankIfsc: body.bankIfsc || null,
        bankName: body.bankName || null,
      },
    });
    return NextResponse.json({ success: true, store });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
