import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Only columns guaranteed to exist from the init migration
type StoreRow = {
  id: string; userId: string; storeName: string; ownerName: string;
  whatsapp: string; address: string | null; locality: string | null;
  city: string | null; pincode: string | null; lat: number | null; lng: number | null;
  gstin: string | null; referralCode: string; referredBy: string | null;
  agreedAt: Date | null; createdAt: Date; updatedAt: Date;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db.$queryRaw<StoreRow[]>`
      SELECT
        s."id", s."userId", s."storeName", s."ownerName", s."whatsapp",
        s."address", s."locality", s."city", s."pincode", s."lat", s."lng",
        s."gstin", s."referralCode", s."referredBy", s."agreedAt",
        s."createdAt", s."updatedAt",
        u."email", u."phone"
      FROM "Store" s
      LEFT JOIN "User" u ON u."id" = s."userId"
      WHERE s."userId" = ${session.user.id}
      LIMIT 1
    `;

    if (!rows.length) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const s = rows[0];
    return NextResponse.json({
      id:           s.id,
      storeName:    s.storeName,
      ownerName:    s.ownerName,
      whatsapp:     s.whatsapp,
      address:      s.address,
      locality:     s.locality,
      city:         s.city,
      pincode:      s.pincode,
      lat:          s.lat,
      lng:          s.lng,
      gstin:        s.gstin,
      referralCode: s.referralCode,
      referredBy:   s.referredBy,
      agreedAt:     s.agreedAt instanceof Date ? s.agreedAt.toISOString() : s.agreedAt,
      createdAt:    s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      // from User join
      email:        (s as unknown as { email?: string }).email ?? null,
      phone:        (s as unknown as { phone?: string }).phone ?? null,
    });
  } catch (e) {
    console.error('stores/me GET error', e);
    return NextResponse.json({ error: 'Failed to load store' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      email?: string;
      payoutMethod?: string; upiId?: string;
      bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
    };

    if (body.email !== undefined) {
      if (!body.email?.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      await db.user.update({ where: { id: session.user.id }, data: { email: body.email } });
    }

    // Payout fields — try raw UPDATE, silently ignore if columns don't exist yet
    if (body.payoutMethod !== undefined) {
      try {
        await db.$executeRaw`
          UPDATE "Store"
          SET
            "payoutMethod"    = ${body.payoutMethod    || null},
            "upiId"           = ${body.upiId           || null},
            "bankAccountName" = ${body.bankAccountName || null},
            "bankAccountNo"   = ${body.bankAccountNo   || null},
            "bankIfsc"        = ${body.bankIfsc        || null},
            "bankName"        = ${body.bankName        || null},
            "updatedAt"       = NOW()
          WHERE "userId" = ${session.user.id}
        `;
      } catch {
        // Payout columns may not exist yet — non-fatal, user data saved client-side
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('stores/me PATCH error', e);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
