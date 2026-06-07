import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { nangoConnectionId } from '@/lib/nango';

// Returns the Nango connectionId for the authenticated brand.
// Frontend uses this with @nangohq/frontend to trigger the OAuth popup.
export async function POST() {
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

  if (!process.env.NANGO_SECRET_KEY) {
    return NextResponse.json({ error: 'Integration not configured' }, { status: 503 });
  }

  return NextResponse.json({ connectionId: nangoConnectionId(user.brand.id) });
}
