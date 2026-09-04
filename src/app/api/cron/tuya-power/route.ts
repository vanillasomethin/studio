import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isCronAuthorized } from '@/lib/cron-auth';
import { isTuyaConfigured, listTuyaDevices } from '@/lib/tuya';
import { recordPlugPoll } from '@/lib/tuya-power';

// Smart-plug power sweep — polls every store-linked Tuya (Aziot) plug and
// appends a PlugReading. Driven at a true 5-minute cadence by
// .github/workflows/tuya-power-cron.yml with a daily vercel.json backstop,
// mirroring device-health. One associated-users device-list call covers the
// whole fleet, so this stays a single Tuya request regardless of store count.

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Observable no-op rather than an error: the endpoint stays green while the
  // Tuya project is not yet configured, and the response says why.
  if (!isTuyaConfigured()) {
    return NextResponse.json({ ok: false, reason: 'tuya_not_configured', polled: 0 });
  }

  const plugs = await db.smartPlug.findMany();
  if (plugs.length === 0) return NextResponse.json({ ok: true, polled: 0 });

  let devices;
  try {
    devices = await listTuyaDevices();
  } catch (e) {
    // A cloud-side failure poisons every plug equally — report it once and let
    // the workflow's failure accounting make a dead integration loud.
    console.error('[tuya-power] device list failed:', e);
    return NextResponse.json({ ok: false, reason: 'tuya_unreachable', polled: 0 }, { status: 502 });
  }
  const byId = new Map(devices.map((d) => [d.id, d]));

  let polled = 0;
  let offline = 0;
  let raced = 0;
  const errors: string[] = [];
  for (const plug of plugs) {
    const device = byId.get(plug.tuyaDeviceId);
    try {
      // A device missing from the account list (unpaired from the app) is
      // recorded as offline, not skipped — the gap must be visible.
      const recorded = await recordPlugPoll(plug, {
        online: !!device?.online,
        name: device?.name,
        status: device?.status,
      });
      // null = an in-line dashboard refresh claimed this window first; its
      // reading covers the gap, so writing ours would double-book the energy.
      if (!recorded) { raced += 1; continue; }
      polled += 1;
      if (!device?.online) offline += 1;
    } catch (e) {
      errors.push(`${plug.tuyaDeviceId}: ${(e as Error).message}`);
    }
  }
  if (errors.length) console.error('[tuya-power] poll errors:', errors);

  return NextResponse.json({ ok: errors.length === 0, polled, offline, raced, errors: errors.length });
}
