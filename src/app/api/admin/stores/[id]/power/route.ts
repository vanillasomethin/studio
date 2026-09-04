import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { isTuyaConfigured } from '@/lib/tuya';
import { plugPowerSummary, refreshPlugIfStale } from '@/lib/tuya-power';

// Live power panel for the admin store card: latest snapshot + today/month
// consumption + 24h/7d series. `?refresh=1` forces a fresh Tuya poll; otherwise
// a stale snapshot is re-polled automatically (cron is only the backstop).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const { id: storeId } = await params;

  const plug = await db.smartPlug.findUnique({ where: { storeId } });
  if (!plug) {
    return NextResponse.json({ linked: false, configured: isTuyaConfigured() });
  }

  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const current = await refreshPlugIfStale(plug, force);
  const summary = await plugPowerSummary(current);
  return NextResponse.json({
    ...summary,
    configured: isTuyaConfigured(),
    // Admin-only: which cloud device backs this panel (partners never see it).
    tuyaDeviceId: current.tuyaDeviceId,
  });
}
