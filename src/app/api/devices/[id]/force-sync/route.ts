// POST /api/devices/[id]/force-sync — bump Device.forceSyncAt so the player's
// next poll sees a newer timestamp and re-fetches/re-downloads content.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const device = await db.device.update({
      where: { id },
      data:  { forceSyncAt: new Date() },
      select: { id: true, forceSyncAt: true },
    });
    // Immediately notify the device via FCM so it doesn't wait for the 15-min poll
    pushPlanUpdated([id]).catch(() => {});
    await logAdminAction({
      actor, req,
      action: 'device.force_sync',
      target: id,
      meta:   { forceSyncAt: device.forceSyncAt?.toISOString() ?? null },
    });
    return NextResponse.json({
      ok: true,
      forceSyncAt: device.forceSyncAt?.toISOString() ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
