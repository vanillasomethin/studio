import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

type Lead = {
  id:        string;
  name:      string;
  email:     string;
  phone:     string;
  message:   string;
  subject:   string;
  createdAt: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Lead, 'id' | 'createdAt'>;

    const lead: Lead = {
      ...body,
      id:        `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis if configured
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const kv       = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
      const existing = (await kv.get<Lead[]>('leads')) ?? [];
      await kv.set('leads', [lead, ...existing]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Failed' }, { status: 500 });
  }
}
