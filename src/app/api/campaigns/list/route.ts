import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { kv } from '@vercel/kv';
import type { Campaign } from '../save/route';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
