import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export type Campaign = {
  id:             string;
  brandName:      string;
  contactName:    string;
  email:          string;
  phone:          string;
  gstin:          string;
  screens:        number;
  months:         number;
  startDate:      string;
  pricePerScreen: number;
  totalAmount:    number;
  paymentId:      string;
  orderId:        string;
  status:         'upcoming' | 'active' | 'completed';
  createdAt:      string;
};

export async function POST(req: NextRequest) {
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ success: true, id: 'demo', note: 'KV not configured' });
  }
  try {
    const body = await req.json() as Omit<Campaign, 'id' | 'createdAt'>;

    const phone = body.phone?.replace(/\D/g, '');
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const campaign: Campaign = {
      ...body,
      id:        `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    const key      = `campaigns:${phone}`;
    const existing = (await kv.get<Campaign[]>(key)) ?? [];
    await kv.set(key, [campaign, ...existing]);

    return NextResponse.json({ success: true, id: campaign.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to save campaign' },
      { status: 500 },
    );
  }
}
