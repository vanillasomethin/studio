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
    const schedules = await db.schedule.findMany({
      include: { playlist: { select: { name: true } } },
      orderBy: { startAt: 'desc' },
    });
    return NextResponse.json({ schedules });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const {
      name, playlistId, groupName, deviceIds,
      startAt, endAt, recurrence,
      dailyStart, dailyEnd, priority,
    } = await req.json() as {
      name:        string;
      playlistId:  string;
      groupName?:  string;
      deviceIds?:  string[];
      startAt:     string;
      endAt:       string;
      recurrence:  'once' | 'daily' | 'weekly';
      dailyStart?: string;
      dailyEnd?:   string;
      priority?:   number;
    };

    if (!name || !playlistId || !startAt || !endAt) {
      return NextResponse.json({ error: 'name, playlistId, startAt, endAt required' }, { status: 400 });
    }

    const schedule = await db.schedule.create({
      data: {
        name,
        playlistId,
        priority:   priority   ?? 0,
        groupName:  groupName  ?? null,
        deviceIds:  deviceIds  ?? [],
        startAt:    new Date(startAt),
        endAt:      new Date(endAt),
        recurrence: (recurrence?.toUpperCase() ?? 'ONCE') as 'ONCE' | 'DAILY' | 'WEEKLY',
        dailyStart: dailyStart ?? null,
        dailyEnd:   dailyEnd   ?? null,
      },
      include: { playlist: { select: { name: true } } },
    });

    return NextResponse.json({ schedule });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
