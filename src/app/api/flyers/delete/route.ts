import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import type { Flyer } from '@/app/api/flyers/save/route';

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

const FLYERS_KEY = 'flyers';

// ─── POST — delete a flyer by id ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check — compare header against env var (if env not set, allow)
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const provided = req.headers.get('admin-password') ?? '';
    if (provided !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const kv = getRedis();
  if (!kv) {
    return NextResponse.json({ success: true, note: 'Redis not configured' });
  }

  try {
    const { id } = await req.json() as { id: string };

    const existing = (await kv.get<Flyer[]>(FLYERS_KEY)) ?? [];
    const updated  = existing.filter((f) => f.id !== id);
    await kv.set(FLYERS_KEY, updated);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to delete flyer' },
      { status: 500 },
    );
  }
}
