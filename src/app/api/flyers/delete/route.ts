import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const INDEX_KEY = 'flyers:index';

export async function POST(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  if (process.env.ADMIN_PASSWORD && pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kv = getRedis();
  if (!kv) return NextResponse.json({ success: true, note: 'Redis not configured' });

  try {
    const { id } = await req.json() as { id: string };

    // Remove from index
    const index   = (await kv.get<string[]>(INDEX_KEY)) ?? [];
    const updated = index.filter((x) => x !== id);
    await kv.set(INDEX_KEY, updated);

    // Delete the individual flyer key
    await kv.del(`flyer:${id}`);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Failed to delete flyer' }, { status: 500 });
  }
}
