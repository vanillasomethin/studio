import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isNangoConnected } from '@/lib/nango';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { brand: { select: { id: true } } },
  });

  if (!user?.brand) {
    return NextResponse.json({ error: 'Not a brand account' }, { status: 403 });
  }

  const connected = await isNangoConnected(user.brand.id);
  return NextResponse.json({ connected });
}
