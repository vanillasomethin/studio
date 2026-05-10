import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// Verifies phone+password and returns the store record.
// The client then calls signIn('phone-password') via Auth.js to establish the session.
export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json() as { phone: string; password: string };
    if (!phone || !password) return NextResponse.json({ store: null });

    const normalized = `+91${phone.replace(/\D/g, '').slice(-10)}`;
    const user = await db.user.findUnique({
      where: { phone: normalized },
      include: { store: true },
    });

    if (!user?.passwordHash || !user.store) {
      return NextResponse.json({ store: null });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ store: null, error: 'Incorrect password.' }, { status: 401 });

    return NextResponse.json({ store: user.store });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
