// GET /api/brand/sla-stats?campaignId=…
// Minimum Play Guarantee: closes any newly-due billing cycles against Proof-of-Play,
// then returns the cycle history (shortfall + remedy, if any) plus a running
// plays-delivered-vs-promised counter for the cycle in progress.
// Auth: next-auth session; the campaign must belong to the logged-in brand's email.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSlaSummary } from '@/lib/sla-db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, email: session.user.email },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const summary = await getSlaSummary(campaignId);
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
