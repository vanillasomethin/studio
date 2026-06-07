import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportCampaignToSheets } from '@/lib/nango';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { brand: { select: { id: true } } },
  });

  if (!user?.brand) {
    return NextResponse.json({ error: 'Not a brand account' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { campaignId?: string };

  try {
    const url = await exportCampaignToSheets(user.brand.id, body.campaignId);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = (err as Error).message ?? 'Export failed';
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
