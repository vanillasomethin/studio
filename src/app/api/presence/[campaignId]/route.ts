// GET /api/presence/:campaignId
// Returns screen-presence correlation stats for a campaign — what fraction
// of ad plays had confirmed in-store footfall presence.
// Auth: admin-password header, OR the campaign's owning brand via Auth.js session.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, email: true, brand: { select: { userId: true } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (!checkAdmin(req)) {
    const session = await auth();
    const owns = session?.user?.email && (session.user.email === campaign.email);
    if (!owns) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const to   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date();
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const events = await db.screenPresenceEvent.findMany({
    where: { campaignId, timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: 'asc' },
  });

  const total = events.length;
  const confirmed = events.filter((e) => e.presenceDetected).length;

  const byStore = new Map<string, { total: number; confirmed: number }>();
  for (const e of events) {
    const prev = byStore.get(e.storeId) ?? { total: 0, confirmed: 0 };
    byStore.set(e.storeId, {
      total: prev.total + 1,
      confirmed: prev.confirmed + (e.presenceDetected ? 1 : 0),
    });
  }

  return NextResponse.json({
    campaignId,
    from: from.toISOString(),
    to: to.toISOString(),
    total,
    confirmed,
    presenceRate: total > 0 ? confirmed / total : null,
    byStore: [...byStore.entries()].map(([storeId, v]) => ({
      storeId,
      total: v.total,
      confirmed: v.confirmed,
      presenceRate: v.total > 0 ? v.confirmed / v.total : null,
    })),
  });
}
