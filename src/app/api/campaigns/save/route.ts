import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brandName:      string;
      contactName:    string;
      email:          string;
      phone:          string;
      gstin?:         string;
      screens:        number;
      months:         number;
      startDate:      string;
      pricePerScreen: number;
      totalAmount:    number;
      paymentId?:     string;
      orderId?:       string;
      status?:        string;
    };

    if (!body.email || !body.brandName) {
      return NextResponse.json({ error: 'brandName and email required' }, { status: 400 });
    }

    // Look up brand by email — optional link
    const brand = await db.brand.findFirst({ where: { email: body.email } });

    const campaign = await db.campaign.create({
      data: {
        brandId:        brand?.id ?? null,
        name:           `${body.brandName} — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
        contactName:    body.contactName,
        email:          body.email,
        phone:          body.phone ?? undefined,
        screens:        body.screens    ?? 1,
        months:         body.months     ?? 1,
        startDate:      new Date(body.startDate),
        pricePerScreen: body.pricePerScreen,
        totalAmount:    body.totalAmount,
        paymentId:      body.paymentId  ?? null,
        orderId:        body.orderId    ?? null,
        status:         body.status     ?? 'upcoming',
      },
    });

    return NextResponse.json({ success: true, id: campaign.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to save campaign' },
      { status: 500 },
    );
  }
}
