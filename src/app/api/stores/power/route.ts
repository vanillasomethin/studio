import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { plugPowerSummary, refreshPlugIfStale } from '@/lib/tuya-power';

// Partner-facing power usage for the store dashboard (web) and store-app
// (mobile). Auth is resolveStoreId, same as every partner route: an explicit
// storeId needs the signed x-store-token header, no storeId falls back to the
// next-auth session.
//
// The response is an explicit ALLOWLIST projected from the shared summary —
// never the summary spread whole. The full PlugPowerSummary carries fields
// that belong to ops (the Smart Life device name is an internal label,
// voltage/current/socket telemetry, the hourly/daily series), and projecting
// here means a field added for the admin panel can never silently ship to
// partners.
//
// A stale snapshot triggers an in-line best-effort re-poll; refreshPlugIfStale
// atomically claims the poll window first, so N parallel requests cost one
// Tuya call and an authenticated partner can't hammer the Tuya API through
// their own dashboard.

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const plug = await db.smartPlug.findUnique({ where: { storeId } });
  if (!plug) return NextResponse.json({ linked: false });

  const current = await refreshPlugIfStale(plug);
  const s = await plugPowerSummary(current);
  return NextResponse.json({
    linked: true,
    online: s.online,
    powerW: s.powerW,
    todayKwh: s.todayKwh,
    monthKwh: s.monthKwh,
    estMonthCostPaise: s.estMonthCostPaise,
    lastPolledAt: s.lastPolledAt,
  });
}
