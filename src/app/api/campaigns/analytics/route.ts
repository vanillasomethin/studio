// GET /api/campaigns/analytics
// Returns real PlayEvent data grouped by day and by campaign for the logged-in brand.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const campaigns = await db.campaign.findMany({
      where:  { email: session.user.email },
      select: { id: true },
    });

    if (campaigns.length === 0) {
      return NextResponse.json({ byDay: [], byCampaign: [] });
    }

    const campaignIds = campaigns.map((c) => c.id);

    // Fetch all raw events (limit to last 90 days to keep it fast)
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const events = await db.playEvent.findMany({
      where:  { campaignId: { in: campaignIds }, createdAt: { gte: since } },
      select: { campaignId: true, durationMs: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dayMap = new Map<string, { plays: number; watchMs: number }>();
    for (const ev of events) {
      const date = ev.createdAt.toISOString().slice(0, 10);
      const prev = dayMap.get(date) ?? { plays: 0, watchMs: 0 };
      dayMap.set(date, { plays: prev.plays + 1, watchMs: prev.watchMs + (ev.durationMs ?? 0) });
    }
    const byDay = [...dayMap.entries()].map(([date, v]) => ({ date, ...v }));

    // Group by campaign
    const campaignMap = new Map<string, { plays: number; watchMs: number }>();
    for (const ev of events) {
      if (!ev.campaignId) continue;
      const prev = campaignMap.get(ev.campaignId) ?? { plays: 0, watchMs: 0 };
      campaignMap.set(ev.campaignId, { plays: prev.plays + 1, watchMs: prev.watchMs + (ev.durationMs ?? 0) });
    }
    const byCampaign = [...campaignMap.entries()].map(([campaignId, v]) => ({ campaignId, ...v }));

    return NextResponse.json({ byDay, byCampaign });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
