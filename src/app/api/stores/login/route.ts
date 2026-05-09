import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import type { Store } from '../save/route';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function POST(req: NextRequest) {
  const { phone } = await req.json() as { phone: string };
  if (!phone) return NextResponse.json({ store: null });

  const kv = getRedis();
  if (!kv) return NextResponse.json({ store: null, note: 'Redis not configured' });

  try {
    const stores = (await kv.get<Store[]>('stores')) ?? [];
    const normalized = phone.replace(/\D/g, '').slice(-10);
    const store = stores.find((s) => {
      const sp = (s.phone ?? s.whatsapp ?? '').replace(/\D/g, '').slice(-10);
      return sp === normalized;
    }) ?? null;
    return NextResponse.json({ store });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
