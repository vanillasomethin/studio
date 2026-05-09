import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import type { Campaign } from '../save/route';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function GET(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  if (process.env.ADMIN_PASSWORD && pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const kv = getRedis();
  if (!kv) return NextResponse.json([]);
  try {
    const campaigns = (await kv.get<Campaign[]>('campaigns:all')) ?? [];
    return NextResponse.json(campaigns);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
