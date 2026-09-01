// GET /api/reach/:campaignId
// Verified Footfall (sensor-covered stores) vs Estimated Reach (everywhere
// else) for a campaign — kept as two separate figures, never blended.
// Auth: a named admin session, OR the campaign's owning brand via Auth.js session.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeCampaignReach } from '@/lib/reach-db';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, email: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (!(await requireAdmin(req))) {
    const session = await auth();
    const owns = session?.user?.email && session.user.email === campaign.email;
    if (!owns) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reach = await computeCampaignReach(campaignId);
  return NextResponse.json({ campaignId, ...reach });
}
