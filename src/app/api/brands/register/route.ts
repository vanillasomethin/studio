import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

type Body = {
  email:       string;
  password:    string;
  brandName?:  string;
  contactName?: string;
  phone?:      string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Body;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || password.length < 6) {
      return NextResponse.json({ error: 'Email and password (min 6 chars) are required.' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        email,
        passwordHash,
        name: body.contactName ?? body.brandName ?? email.split('@')[0],
        role: 'BRAND',
        brand: body.brandName ? {
          create: {
            brandName:   body.brandName,
            contactName: body.contactName ?? email.split('@')[0],
            email,
            phone:       body.phone ?? '',
          },
        } : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Registration failed.' }, { status: 500 });
  }
}
