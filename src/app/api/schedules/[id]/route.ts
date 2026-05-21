// PATCH /api/schedules/[id]  — update a schedule
// DELETE /api/schedules/[id] — delete a schedule
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pushPlanUpdated, resolveScheduleDeviceIds } from '@/lib/fcm';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const {
      name, playlistId, groupName, deviceIds, storeIds, cityFilter,
      startAt, endAt, recurrence,
      dailyStart, dailyEnd, priority,
      orientation, intervalMins,
    } = await req.json() as {
      name?:         string;
      playlistId?:   string;
      groupName?:    string | null;
      deviceIds?:    string[];
      storeIds?:     string[];
      cityFilter?:   string | null;
      startAt?:      string;
      endAt?:        string;
      recurrence?:   'once' | 'daily' | 'weekly';
      dailyStart?:   string | null;
      dailyEnd?:     string | null;
      priority?:     number;
      orientation?:  'landscape' | 'portrait' | 'any';
      intervalMins?: number | null;
    };

    const data: Record<string, unknown> = {};
    if (name         !== undefined) data.name         = name;
    if (playlistId   !== undefined) data.playlistId   = playlistId;
    if (groupName    !== undefined) data.groupName    = groupName ?? null;
    if (deviceIds    !== undefined) data.deviceIds    = deviceIds;
    if (storeIds     !== undefined) data.storeIds     = storeIds;
    if (cityFilter   !== undefined) data.cityFilter   = cityFilter ?? null;
    if (startAt      !== undefined) data.startAt      = new Date(startAt);
    if (endAt        !== undefined) data.endAt        = new Date(endAt);
    if (recurrence   !== undefined) data.recurrence   = recurrence.toUpperCase() as 'ONCE' | 'DAILY' | 'WEEKLY';
    if (dailyStart   !== undefined) data.dailyStart   = dailyStart ?? null;
    if (dailyEnd     !== undefined) data.dailyEnd     = dailyEnd ?? null;
    if (priority     !== undefined) data.priority     = priority;
    if (orientation  !== undefined) data.orientation  = orientation;
    if (intervalMins !== undefined) data.intervalMins = intervalMins ?? null;

    let updated;
    try {
      updated = await db.schedule.update({
        where: { id },
        data,
        include: { playlist: { select: { name: true } } },
      });
    } catch (e1) {
      const msg1 = (e1 as Error).message ?? '';
      if (!msg1.includes('orientation') && !msg1.includes('intervalMins') && !msg1.includes('column')) throw e1;
      // orientation/intervalMins columns not yet migrated — update without them
      const { orientation: _o, intervalMins: _i, ...safeData } = data;
      void _o; void _i;
      updated = await db.schedule.update({
        where: { id },
        data:  safeData,
        include: { playlist: { select: { name: true } } },
      });
    }

    const norm = {
      ...updated,
      orientation:  (updated as { orientation?: string }).orientation  ?? 'landscape',
      intervalMins: (updated as { intervalMins?: number | null }).intervalMins ?? null,
      recurrence:   updated.recurrence.toLowerCase() as 'once' | 'daily' | 'weekly',
      startAt:      updated.startAt.toISOString(),
      endAt:        updated.endAt.toISOString(),
      createdAt:    updated.createdAt.toISOString(),
    };

    // Push plan_updated to affected devices (best-effort, non-blocking)
    resolveScheduleDeviceIds({
      deviceIds:  updated.deviceIds,
      groupName:  updated.groupName,
      storeIds:   (updated as { storeIds?: string[] }).storeIds,
      cityFilter: (updated as { cityFilter?: string | null }).cityFilter,
    }).then((ids) => pushPlanUpdated(ids)).catch(() => {});

    return NextResponse.json({ schedule: norm });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await db.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
