// GET  /api/brand/addons?campaignId=…   — per-store Peak Boost / Sound Ad status
// POST /api/brand/addons { campaignId, storeId, type }  — purchase (FCFS)
// Auth: next-auth session; the campaign must belong to the logged-in brand's email.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCampaignAddonState, purchaseAddon } from '@/lib/addons-db';
import type { AddonType } from '@/lib/addons';

async function ownedCampaign(campaignId: string, email: string) {
  return db.campaign.findFirst({ where: { id: campaignId, email }, select: { id: true } });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  if (!(await ownedCampaign(campaignId, session.user.email))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const stores = await getCampaignAddonState(campaignId);
  return NextResponse.json({ stores });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { campaignId?: string; storeId?: string; type?: string } | null;
  const campaignId = body?.campaignId ?? '';
  const storeId = body?.storeId ?? '';
  const type = body?.type;
  if (!campaignId || !storeId || (type !== 'peak_boost' && type !== 'sound_ad')) {
    return NextResponse.json({ error: 'campaignId, storeId and a valid type are required' }, { status: 400 });
  }
  if (!(await ownedCampaign(campaignId, session.user.email))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await purchaseAddon(storeId, campaignId, type as AddonType);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
