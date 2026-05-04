import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ success: true, id: 'demo', note: 'KV not configured' });
  }
  try {
    const { userId } = await auth();
    const body = await req.json() as Omit<Campaign, 'id' | 'createdAt'>;

    const campaign: Campaign = {
      ...body,
      id:        `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    // Key by userId when authenticated, fall back to email so anonymous payments still persist
    const key      = userId ? `campaigns:user:${userId}` : `campaigns:email:${body.email}`;
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
