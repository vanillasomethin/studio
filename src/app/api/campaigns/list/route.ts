import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
import type { Campaign } from '../save/route';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ campaigns: [] });
  }
  try {
    const user  = await currentUser();
    const phone = user?.phoneNumbers?.[0]?.phoneNumber?.replace(/\D/g, '');

    if (!phone) {
      return NextResponse.json({ campaigns: [] });
    }

    const campaigns = (await kv.get<Campaign[]>(`campaigns:${phone}`)) ?? [];
    return NextResponse.json({ campaigns });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to fetch campaigns' },
      { status: 500 },
    );
  }
}
