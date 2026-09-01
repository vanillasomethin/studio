// Screen-offline alerts for the partner's own store.
//   GET   → this store's open alerts (+ recently resolved, so the dashboard can
//           show "back online" instead of the warning silently disappearing)
//   PATCH → mark them read
//   POST  → the partner answers "why is it off?" (power cut / no internet / …)
//
// Auth: resolveStoreId() only — never a bare storeId from the body. The store id
// doubles as a bearer credential in this codebase, so this route must go through
// the signed-token / session path like every other partner route.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';

// Whitelist, not free text: the value lands in admin tooling and (later) gets
// diffed against the telemetry verdict, so it has to be one of a closed set.
const PARTNER_CAUSES = ['POWER_CUT', 'NO_INTERNET', 'TV_OFF', 'APP_CLOSED', 'DONT_KNOW'] as const;
type PartnerCause = (typeof PARTNER_CAUSES)[number];

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const recentlyResolved = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const alerts = await db.deviceAlert.findMany({
      where: {
        storeId,
        OR: [
          { status: 'OPEN' },
          // Only show a fixed outage to a partner who was actually told it broke.
          // Without this gate the "back online" entry can be the first they hear of
          // an incident — exactly what the notification path already refuses to do
          // (see resolveOfflineAlerts) — and every outage reconstructed by
          // backfillMissedOutage would surface here: resolved on creation, never
          // notified, for a problem that was already over before anyone looked.
          { status: 'RESOLVED', resolvedAt: { gte: recentlyResolved }, partnerNotifiedAt: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, status: true, severity: true, deviceName: true,
        lastSeenAt: true, startedAt: true, resolvedAt: true, partnerReadAt: true,
        partnerReportedCause: true,
      },
    });
    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}

// The partner tells us why the screen is off. One tap on the dashboard banner —
// the cheapest diagnostic signal available while no player build reports uptime
// telemetry (the server-side classifier returns UNKNOWN fleet-wide until then),
// and it decides whether someone has to drive to the store.
export async function POST(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { alertId?: unknown; cause?: unknown };
  try { body = await req.json(); } catch { body = {}; }

  const alertId = typeof body.alertId === 'string' ? body.alertId : '';
  const cause   = typeof body.cause === 'string' ? body.cause : '';
  if (!alertId || !PARTNER_CAUSES.includes(cause as PartnerCause)) {
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }

  try {
    // Scoped to this store in the WHERE — a partner can only ever annotate their
    // own alert; a guessed alertId for someone else's store matches nothing.
    // Overwrites are allowed on purpose: "power cut" corrected to "wifi was
    // down" a minute later is a better record, not a worse one, and replaying
    // the id can do nothing beyond that.
    const updated = await db.deviceAlert.updateMany({
      where: { id: alertId, storeId },
      data:  { partnerReportedCause: cause, partnerReportedAt: new Date() },
    });
    if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('stores/alerts POST failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Scoped to this store — a partner can only ever mark their own alerts read.
    await db.deviceAlert.updateMany({
      where: { storeId, partnerReadAt: null },
      data:  { partnerReadAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('stores/alerts PATCH failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not update alerts' }, { status: 500 });
  }
}
