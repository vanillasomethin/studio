import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { email } = await req.json() as { email?: string };
  if (!email?.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  await db.user.update({ where: { id: session.user.id }, data: { email } });
  return NextResponse.json({ ok: true });
}

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
