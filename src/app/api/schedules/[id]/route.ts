// PATCH /api/schedules/[id]  — update a schedule
// DELETE /api/schedules/[id] — delete a schedule
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
      name, playlistId, groupName, deviceIds,
      startAt, endAt, recurrence,
      dailyStart, dailyEnd, priority,
      orientation, intervalMins,
    } = await req.json() as {
      name?:         string;
      playlistId?:   string;
      groupName?:    string | null;
      deviceIds?:    string[];
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
    if (startAt      !== undefined) data.startAt      = new Date(startAt);
    if (endAt        !== undefined) data.endAt        = new Date(endAt);
    if (recurrence   !== undefined) data.recurrence   = recurrence.toUpperCase() as 'ONCE' | 'DAILY' | 'WEEKLY';
    if (dailyStart   !== undefined) data.dailyStart   = dailyStart ?? null;
    if (dailyEnd     !== undefined) data.dailyEnd     = dailyEnd ?? null;
    if (priority     !== undefined) data.priority     = priority;
    if (orientation  !== undefined) data.orientation  = orientation;
    if (intervalMins !== undefined) data.intervalMins = intervalMins ?? null;

    const updated = await db.schedule.update({
      where: { id },
      data,
      include: { playlist: { select: { name: true } } },
    });

    const norm = {
      ...updated,
      orientation:  (updated as { orientation?: string }).orientation  ?? 'landscape',
      intervalMins: (updated as { intervalMins?: number | null }).intervalMins ?? null,
      recurrence:   updated.recurrence.toLowerCase() as 'once' | 'daily' | 'weekly',
      startAt:      updated.startAt.toISOString(),
      endAt:        updated.endAt.toISOString(),
      createdAt:    updated.createdAt.toISOString(),
    };
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
