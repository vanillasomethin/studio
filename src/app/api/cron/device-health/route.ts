// Vercel cron job — runs every 5 minutes.
// Marks devices OFFLINE if lastSeen > 10 minutes ago.
// Updates 30-day rolling uptime estimate (uptimePctD30).
//
// GET /api/cron/device-health
// Auth: CRON_SECRET (Vercel sets Authorization: Bearer <secret>)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now           = new Date();
  const offlineThresh = new Date(now.getTime() - 10 * 60 * 1000);   // 10 min
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // 1. Mark devices that haven't been seen in 10+ minutes as OFFLINE
    const { count: markedOffline } = await db.device.updateMany({
      where: {
        status:  { not: 'OFFLINE' },
        lastSeen: { lt: offlineThresh },
      },
      data: { status: 'OFFLINE' },
    });

    // 2. Recalculate rolling 30-day uptime for all non-PENDING devices
    const devices = await db.device.findMany({
      where:  { status: { not: 'PENDING' } },
      select: { id: true, claimedAt: true },
    });

    for (const device of devices) {
      const windowStart = device.claimedAt > thirtyDaysAgo ? device.claimedAt : thirtyDaysAgo;
      const windowMs    = now.getTime() - windowStart.getTime();
      if (windowMs <= 0) continue;

      // Sum total online time from play events within the window
      const events = await db.playEvent.aggregate({
        where:  { deviceId: device.id, startedAt: { gte: windowStart } },
        _sum:   { durationMs: true },
      });

      const onlineMs     = events._sum.durationMs ?? 0;
      const uptimePctD30 = Math.min(100, (onlineMs / windowMs) * 100);

      await db.device.update({
        where: { id: device.id },
        data:  { uptimePctD30 },
      });
    }

    return NextResponse.json({ ok: true, markedOffline, updatedUptime: devices.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
