// POST /api/devices/bulk-schedule
// Creates a high-priority takeover schedule for specified devices.
// Body: { deviceIds: string[], playlistId: string, durationMins: number, name?: string }
// Auth: admin-password header

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { pushPlanUpdated, resolveScheduleDeviceIds } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { deviceIds, playlistId, durationMins, name } = await req.json() as {
      deviceIds:   string[];
      playlistId:  string;
      durationMins: number;
      name?:       string;
    };

    if (!deviceIds?.length)  return NextResponse.json({ error: 'deviceIds required' }, { status: 400 });
    if (!playlistId)          return NextResponse.json({ error: 'playlistId required' }, { status: 400 });
    if (!durationMins || durationMins < 1) return NextResponse.json({ error: 'durationMins must be >= 1' }, { status: 400 });

    const startAt = new Date();
    const endAt   = new Date(startAt.getTime() + durationMins * 60 * 1000);

    const schedule = await db.schedule.create({
      data: {
        name:       name ?? `Takeover ${startAt.toLocaleString('en-IN')}`,
        playlistId,
        deviceIds,
        priority:   9,   // highest priority — overrides any other active schedule
        startAt,
        endAt,
        recurrence: 'ONCE',
        orientation: 'portrait',
      },
    });

    // Tell the screens now instead of leaving them on the old playlist until
    // their next poll. This route created the takeover and returned, so a
    // priority-9 override — the most time-critical schedule the platform has,
    // the one an operator reaches for when the wrong thing is on screen — took
    // up to a full poll interval to appear. Every sibling schedule route pushes.
    //
    // after(), not a floating promise: on Vercel the instance can be frozen the
    // moment the response is sent, which drops an in-flight push and puts the
    // delay straight back. The sibling routes use a bare `.catch(() => {})` and
    // have the same exposure; /api/device/events already made this argument in
    // its own comment. Errors stay swallowed — a push that fails must not fail
    // a takeover that is already committed to the database.
    after(async () => {
      try {
        const ids = await resolveScheduleDeviceIds({
          deviceIds:  schedule.deviceIds,
          groupName:  null,
          storeIds:   [],
          cityFilter: null,
        });
        if (ids.length) await pushPlanUpdated(ids);
      } catch { /* best-effort */ }
    });

    // priority 9 overrides every other active schedule on the targeted screens.
    // If one admin action is ever worth alerting on, it is this one.
    await logAdminAction({
      actor, req,
      action: 'schedule.takeover',
      target: schedule.id,
      meta:   { deviceIds, playlistId, durationMins, screens: deviceIds.length },
    });

    return NextResponse.json({ schedule: { id: schedule.id, name: schedule.name, endsAt: schedule.endAt } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
