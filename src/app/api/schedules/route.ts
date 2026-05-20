// Schedule CRUD.
// GET  /api/schedules   → { schedules: Schedule[] }
// POST /api/schedules   → { schedule: Schedule }
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await db.schedule.findMany({
      select: {
        id:          true,
        name:        true,
        playlistId:  true,
        priority:    true,
        deviceIds:   true,
        groupName:   true,
        storeIds:    true,
        cityFilter:  true,
        startAt:     true,
        endAt:       true,
        recurrence:  true,
        dailyStart:  true,
        dailyEnd:    true,
        createdAt:   true,
        orientation:  true,
        intervalMins: true,
        playlist: { select: { name: true } },
      },
      orderBy: { startAt: 'desc' },
    });
    const schedules = rows.map((s) => ({
      ...s,
      orientation:  (s as { orientation?: string }).orientation  ?? 'landscape',
      intervalMins: (s as { intervalMins?: number | null }).intervalMins ?? null,
      recurrence:   s.recurrence.toLowerCase() as 'once' | 'daily' | 'weekly',
      startAt:      s.startAt.toISOString(),
      endAt:        s.endAt.toISOString(),
      createdAt:    s.createdAt.toISOString(),
    }));
    return NextResponse.json({ schedules });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    // If new columns don't exist yet (migration pending), fall back to core fields only
    if (msg.includes('orientation') || msg.includes('intervalMins') || msg.includes('column')) {
      try {
        const rows = await db.schedule.findMany({
          select: {
            id: true, name: true, playlistId: true, priority: true,
            deviceIds: true, groupName: true, startAt: true, endAt: true,
            recurrence: true, dailyStart: true, dailyEnd: true, createdAt: true,
            playlist: { select: { name: true } },
          },
          orderBy: { startAt: 'desc' },
        });
        const schedules = rows.map((s) => ({
          ...s,
          orientation:  'landscape' as const,
          intervalMins: null,
          recurrence:   s.recurrence.toLowerCase() as 'once' | 'daily' | 'weekly',
          startAt:      s.startAt.toISOString(),
          endAt:        s.endAt.toISOString(),
          createdAt:    s.createdAt.toISOString(),
        }));
        return NextResponse.json({ schedules });
      } catch (e2) {
        return NextResponse.json({ error: (e2 as Error).message }, { status: 500 });
      }
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const {
      name, playlistId, groupName, deviceIds, storeIds, cityFilter,
      startAt, endAt, recurrence,
      dailyStart, dailyEnd, priority,
      orientation, intervalMins,
    } = await req.json() as {
      name:          string;
      playlistId:    string;
      groupName?:    string;
      deviceIds?:    string[];
      storeIds?:     string[];
      cityFilter?:   string | null;
      startAt:       string;
      endAt:         string;
      recurrence:    'once' | 'daily' | 'weekly';
      dailyStart?:   string;
      dailyEnd?:     string;
      priority?:     number;
      orientation?:  'landscape' | 'portrait' | 'any';
      intervalMins?: number | null;
    };

    if (!name || !playlistId || !startAt || !endAt) {
      return NextResponse.json({ error: 'name, playlistId, startAt, endAt required' }, { status: 400 });
    }

    const baseData = {
      name,
      playlistId,
      priority:   priority   ?? 0,
      groupName:  groupName  ?? null,
      deviceIds:  deviceIds  ?? [],
      storeIds:   storeIds   ?? [],
      cityFilter: cityFilter ?? null,
      startAt:    new Date(startAt),
      endAt:      new Date(endAt),
      recurrence: (recurrence?.toUpperCase() ?? 'ONCE') as 'ONCE' | 'DAILY' | 'WEEKLY',
      dailyStart: dailyStart ?? null,
      dailyEnd:   dailyEnd   ?? null,
    };

    let schedule;
    try {
      schedule = await db.schedule.create({
        data: { ...baseData, orientation: orientation ?? 'landscape', intervalMins: intervalMins ?? null },
        include: { playlist: { select: { name: true } } },
      });
    } catch (e1) {
      const msg1 = (e1 as Error).message ?? '';
      if (!msg1.includes('orientation') && !msg1.includes('intervalMins') && !msg1.includes('column')) throw e1;
      // orientation/intervalMins columns not yet migrated — create without them
      schedule = await db.schedule.create({
        data: baseData,
        include: { playlist: { select: { name: true } } },
      });
    }

    const norm = {
      ...schedule,
      orientation:  (schedule as { orientation?: string }).orientation  ?? 'landscape',
      intervalMins: (schedule as { intervalMins?: number | null }).intervalMins ?? null,
      recurrence:   schedule.recurrence.toLowerCase() as 'once' | 'daily' | 'weekly',
      startAt:      schedule.startAt.toISOString(),
      endAt:        schedule.endAt.toISOString(),
      createdAt:    schedule.createdAt.toISOString(),
    };
    return NextResponse.json({ schedule: norm });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
