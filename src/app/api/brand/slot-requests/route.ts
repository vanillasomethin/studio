// POST   /api/brand/slot-requests { campaignId, storeId, window, note? } — spend
//        credits requesting a store + time-window. Request-only: nothing books until
//        ALIVE admin approves and manually assigns the real SlotBooking.
// DELETE /api/brand/slot-requests?id=&campaignId= — cancel your own pending request.
// Auth: next-auth session; campaign must belong to the brand.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createSlotRequest, cancelSlotRequest } from '@/lib/slot-requests-db';

async function ownedCampaign(campaignId: string, email: string) {
  return db.campaign.findFirst({ where: { id: campaignId, email }, select: { id: true } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { campaignId?: string; storeId?: string; window?: string; note?: string } | null;
  const campaignId = body?.campaignId ?? '';
  const storeId = body?.storeId ?? '';
  const window = body?.window ?? '';
  if (!campaignId || !storeId || !window) {
    return NextResponse.json({ error: 'campaignId, storeId and window are required' }, { status: 400 });
  }
  if (!(await ownedCampaign(campaignId, session.user.email))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await createSlotRequest({ campaignId, storeId, window, note: body?.note });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!id || !campaignId) return NextResponse.json({ error: 'id and campaignId required' }, { status: 400 });
  if (!(await ownedCampaign(campaignId, session.user.email))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const cancelled = await cancelSlotRequest(id, campaignId);
  if (!cancelled) return NextResponse.json({ error: 'Request not found or no longer pending' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
