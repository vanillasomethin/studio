import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const campaigns = await db.campaign.findMany({
      where:   { email: session.user.email },
      orderBy: { createdAt: 'desc' },
      include: {
        brand: { select: { brandName: true, trialOfferedAt: true, trialUsedAt: true } },
      },
    });

    const result = campaigns.map((c) => ({
      id:             c.id,
      name:           c.name,
      brandName:      c.brand?.brandName ?? c.name.split(' — ')[0],
      contactName:    c.contactName,
      email:          c.email,
      phone:          c.phone,
      gstin:          null as string | null,
      screens:        c.screens,
      months:         c.months,
      startDate:      c.startDate.toISOString(),
      pricePerScreen: c.pricePerScreen,
      totalAmount:    c.totalAmount,
      paymentId:      c.paymentId,
      orderId:        c.orderId ?? null,
      status:         c.status,
      creativeUrls:   c.creativeUrls,
      createdAt:      c.createdAt.toISOString(),
    }));

    // Fetch brand trial status separately
    const brandRow = campaigns[0]?.brand ?? null;
    const trialOfferedAt = brandRow?.trialOfferedAt?.toISOString() ?? null;
    const trialUsedAt    = brandRow?.trialUsedAt?.toISOString()    ?? null;

    return NextResponse.json({ campaigns: result, trialOfferedAt, trialUsedAt });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to fetch campaigns' },
      { status: 500 },
    );
  }
}

