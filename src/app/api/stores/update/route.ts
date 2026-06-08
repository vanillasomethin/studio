import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { email?: string };

  if (body.email !== undefined) {
    const email = body.email.trim();
    if (email && !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    await db.user.update({
      where: { id: session.user.id },
      data:  { email: email || null },
    });
  }

  return NextResponse.json({ success: true });
}
