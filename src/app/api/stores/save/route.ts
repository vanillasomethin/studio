import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Store = {
  id:          string;
  storeName:   string;
  ownerName:   string;
  phone:       string;
  whatsapp:    string;
  address:     string;
  area:        string;
  city:        string;
  pincode:     string;
  screenCount: string;
  createdAt:   string;
};

// ─── Redis client ─────────────────────────────────────────────────────────────

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const STORES_KEY = 'stores';

// ─── GET — list all stores (admin) ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  if (process.env.ADMIN_PASSWORD && pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const kv = getRedis();
  if (!kv) return NextResponse.json([]);
  try {
    const stores = (await kv.get<Store[]>(STORES_KEY)) ?? [];
    return NextResponse.json(stores);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ─── POST — register a store ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const kv = getRedis();
  if (!kv) {
    return NextResponse.json({ success: true, id: 'demo', note: 'Redis not configured' });
  }

  try {
    const body = await req.json() as Omit<Store, 'id' | 'createdAt'>;

    const store: Store = {
      ...body,
      id:        `store_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    const existing = (await kv.get<Store[]>(STORES_KEY)) ?? [];
    await kv.set(STORES_KEY, [store, ...existing]);

    return NextResponse.json({ success: true, id: store.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to save store' },
      { status: 500 },
    );
  }
}
