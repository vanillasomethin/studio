// GET /api/devices  — list all registered devices with status
// Status is computed on-read from lastSeen — no cron required.
// A device is ONLINE if lastSeen within the past 5 minutes, OFFLINE otherwise,
// PENDING if it has never checked in.
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

function effectiveStatus(lastSeen: Date | null, dbStatus: string): 'ONLINE' | 'OFFLINE' | 'PENDING' {
  if (dbStatus === 'PENDING' && !lastSeen) return 'PENDING';
  if (!lastSeen) return 'OFFLINE';
  return Date.now() - lastSeen.getTime() < OFFLINE_THRESHOLD_MS ? 'ONLINE' : 'OFFLINE';
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await db.device.findMany({
      orderBy: { claimedAt: 'desc' },
      select: {
        id:           true,
        hardwareKey:  true,
        name:         true,
        storeId:      true,
        status:       true,
        lastSeen:     true,
        groupName:    true,
        claimedAt:    true,
        uptimePctD30: true,
      },
    });

    const now = new Date();

    // Fetch active schedules for all devices/groups in one query
    const deviceIds   = rows.map((d) => d.id);
    const groupNames  = [...new Set(rows.map((d) => d.groupName).filter(Boolean))] as string[];

    const activeSchedules = await db.schedule.findMany({
      where: {
        startAt: { lte: now },
        endAt:   { gte: now },
        OR: [
          ...(deviceIds.length  ? [{ deviceIds: { hasSome: deviceIds } }]  : []),
          ...(groupNames.length ? [{ groupName: { in: groupNames } }]       : []),
        ],
      },
      // Explicit select — excludes orientation/intervalMins so this works before migration
      select: {
        id:        true,
        name:      true,
        playlistId: true,
        priority:  true,
        deviceIds: true,
        groupName: true,
        startAt:   true,
        endAt:     true,
        playlist: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { startAt: 'asc' }],
    });

    // Fetch last play event per device
    const lastEvents = await db.playEvent.groupBy({
      by:      ['deviceId'],
      where:   { deviceId: { in: deviceIds } },
      _max:    { startedAt: true },
    });
    const lastPlayMap = new Map(lastEvents.map((e) => [e.deviceId, e._max.startedAt]));

    // Build per-device current schedule lookup
    function currentScheduleFor(deviceId: string, groupName: string | null) {
      return activeSchedules.find(
        (s) =>
          (s.deviceIds as string[]).includes(deviceId) ||
          (groupName && s.groupName === groupName),
      ) ?? null;
    }

    const devices = rows.map((d) => {
      const sched = currentScheduleFor(d.id, d.groupName);
      return {
        id:         d.id,
        hardwareKey: d.hardwareKey,
        storeName:  d.name,
        storeId:    d.storeId,
        groupName:  d.groupName,
        status:     effectiveStatus(d.lastSeen, d.status),
        uptimePct:  d.uptimePctD30,
        lastSeen:   d.lastSeen?.toISOString() ?? null,
        lastPlayAt: lastPlayMap.get(d.id)?.toISOString() ?? null,
        claimedAt:  d.claimedAt.toISOString(),
        currentSchedule: sched ? {
          id:           sched.id,
          name:         sched.name,
          playlistName: sched.playlist?.name ?? null,
          endsAt:       sched.endAt.toISOString(),
        } : null,
      };
    });

    return NextResponse.json({ devices });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
