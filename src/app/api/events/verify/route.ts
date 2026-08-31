// Verify the POP audit hash chain for a device.
// GET /api/events/verify?deviceId=<id>
// Auth: admin-password header
// Returns: { deviceId, total, broken: number, firstBrokenId, ok: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

function computeRowHash(id: string, deviceId: string, mediaId: string, startedAt: string, endedAt: string, durationMs: number, tag: string | null, prevHash: string | null): string {
  const data = [id, deviceId, mediaId, startedAt, endedAt, String(durationMs), tag ?? '', prevHash ?? ''].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deviceId = req.nextUrl.searchParams.get('deviceId');
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 });

  try {
    // Walk in INSERTION order, matching how /api/device/events builds the chain.
    // Walking startedAt instead reported a break every time a device drained an
    // offline backlog out of order: the rows were chained as they arrived, so
    // replaying them in play-time order compares each link against the wrong
    // neighbour. The chain attests to the order evidence was accepted, which is
    // the only order the writer can observe.
    const events = await db.playEvent.findMany({
      where:   { deviceId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select:  { id: true, deviceId: true, mediaId: true, startedAt: true, endedAt: true, durationMs: true, tag: true, prevHash: true, rowHash: true },
    });

    let broken = 0;
    let firstBrokenId: string | null = null;
    let expectedPrev: string | null = null;

    for (const ev of events) {
      const expected = computeRowHash(
        ev.id, ev.deviceId, ev.mediaId,
        ev.startedAt.toISOString(), ev.endedAt.toISOString(),
        ev.durationMs, ev.tag ?? null, ev.prevHash ?? null,
      );

      const hashMismatch = ev.rowHash !== expected;
      const prevMismatch = ev.prevHash !== expectedPrev;

      if (hashMismatch || prevMismatch) {
        broken++;
        if (!firstBrokenId) firstBrokenId = ev.id;
      }

      expectedPrev = ev.rowHash;
    }

    return NextResponse.json({
      deviceId,
      total:          events.length,
      broken,
      firstBrokenId,
      ok:             broken === 0,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
