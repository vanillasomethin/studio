import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ leads: [] });
  }
  try {
    const kv    = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
    const leads = (await kv.get<Lead[]>('leads')) ?? [];
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
