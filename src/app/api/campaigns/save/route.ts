import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { respond } from '@/lib/api-envelope';

export async function POST(req: NextRequest) {
  const route = '/api/campaigns/save';
  const startedAtMs = Date.now();
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
      const envelope = await respond({ error: 'brandName and email required' }, { route, request: { hasEmail: !!body.email, hasBrandName: !!body.brandName }, outcome: 'invalid_request', policyFlags: ['missing_required_fields'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
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

    const envelope = await respond({ success: true, id: campaign.id }, { route, request: { email: body.email, brandName: body.brandName }, outcome: 'success', startedAtMs });
    return NextResponse.json(envelope);
  } catch (e) {
    const envelope = await respond({ error: (e as Error).message ?? 'Failed to save campaign' }, { route, request: { operation: 'create_campaign' }, outcome: 'server_error', policyFlags: ['exception'], errorCategory: 'runtime', startedAtMs });
    return NextResponse.json(envelope, { status: 500 });
  }
}
