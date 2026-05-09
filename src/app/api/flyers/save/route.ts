import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Flyer = {
  id:           string;
  storeName:    string;
  title:        string;
  description:  string;
  validUntil:   string;
  imageBase64:  string;
  createdAt:    string;
};

// ─── Redis client (lazy — only constructed when env vars are present) ─────────

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const FLYERS_KEY = 'flyers';

// ─── POST — save a flyer ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const kv = getRedis();
  if (!kv) {
    return NextResponse.json({ success: true, id: 'demo', note: 'Redis not configured' });
  }

  try {
    const body = await req.json() as {
      storeName:   string;
      title:       string;
      description: string;
      validUntil:  string;
      imageBase64: string;
    };

    const flyer: Flyer = {
      ...body,
      id:        `flyer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    const existing = (await kv.get<Flyer[]>(FLYERS_KEY)) ?? [];
    await kv.set(FLYERS_KEY, [flyer, ...existing]);

    return NextResponse.json({ success: true, id: flyer.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to save flyer' },
      { status: 500 },
    );
  }
}

// ─── GET — list all flyers ────────────────────────────────────────────────────

export async function GET() {
  const kv = getRedis();
  if (!kv) {
    return NextResponse.json([]);
  }

  try {
    const flyers = (await kv.get<Flyer[]>(FLYERS_KEY)) ?? [];
    return NextResponse.json(flyers);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to fetch flyers' },
      { status: 500 },
    );
  }
}
