import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  if (process.env.ADMIN_PASSWORD && pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { brand: { select: { brandName: true } } },
    });

    const result = campaigns.map((c) => ({
      id:             c.id,
      brandName:      c.brand?.brandName ?? c.name.split(' — ')[0],
      contactName:    c.contactName,
      email:          c.email,
      phone:          c.phone,
      screens:        c.screens,
      months:         c.months,
      startDate:      c.startDate.toISOString(),
      pricePerScreen: c.pricePerScreen,
      totalAmount:    c.totalAmount,
      paymentId:      c.paymentId,
      orderId:        c.orderId ?? null,
      status:         c.status,
      createdAt:      c.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
