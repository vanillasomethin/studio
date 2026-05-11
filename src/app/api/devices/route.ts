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
    const devices = rows.map((d) => ({
      ...d,
      storeName: d.name,
      status:    effectiveStatus(d.lastSeen, d.status),
      uptimePct: d.uptimePctD30,
      lastSeen:  d.lastSeen?.toISOString() ?? null,
      claimedAt: d.claimedAt.toISOString(),
    }));
    return NextResponse.json({ devices });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
