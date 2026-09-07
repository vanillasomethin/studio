// GET /api/brand/content-quota?campaignId=…
// This campaign's monthly creative-change quota status. Auth: next-auth session;
// campaign must belong to the brand.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getContentQuotaStatus } from '@/lib/content-quota-db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, email: session.user.email }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  return NextResponse.json(await getContentQuotaStatus(campaignId));
}
