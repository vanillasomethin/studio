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
      // Case-insensitive: campaigns are stored with a normalised address while
      // the session carries it as the brand typed it, so an exact match would
      // hide a brand's own campaigns from them.
      where:   { email: { equals: session.user.email, mode: 'insensitive' } },
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
      // The stores this campaign booked. The dashboard's pay-later flow must
      // send these to create-order or the charge falls back to the count path
      // at the Standard rate — a campaign of Flagship stores would settle at a
      // third of its price.
      preferredStoreIds: c.preferredStoreIds,
      // The promo the pay-later quote honoured. Any flow charging this
      // campaign must hand it back to create-order along with the storeIds
      // above — the charge is recomputed there, and without the code it comes
      // out full-price against a discounted quote.
      couponCode:     c.couponCode,
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

