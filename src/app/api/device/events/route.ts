// Device play-event ingest — player POSTs proof-of-play rows in batches.
// Idempotent by id: duplicate submissions are silently ignored.
//
// POST /api/device/events
// Auth: Authorization: Bearer <device-jwt>
// Body: { events: PlayEventInput[] }
// Returns: { accepted: number }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyDeviceToken } from '@/lib/device-auth';

type PlayEventInput = {
  id:         string;   // client-generated UUID for dedup
  mediaId:    string;   // Content.id
  scheduleId?: string;
  campaignId?: string;
  tag?:        string;
  startedAt:  string;   // ISO
  endedAt:    string;   // ISO
  durationMs: number;
};

async function authenticate(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload  = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const deviceId = payload?.sub as string | undefined;
    if (!deviceId) return null;
    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) return null;
    const result = await verifyDeviceToken(token, device.jwtSecret);
    if (!result) return null;
    return device;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const device = await authenticate(req);
  if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { events } = await req.json() as { events: PlayEventInput[] };
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ accepted: 0 });
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 500);

    let accepted = 0;
    for (const ev of batch) {
      if (!ev.id || !ev.mediaId || !ev.startedAt || !ev.endedAt) continue;
      try {
        await db.playEvent.upsert({
          where:  { id: ev.id },
          update: {}, // already accepted — no-op
          create: {
            id:         ev.id,
            deviceId:   device.id,
            mediaId:    ev.mediaId,
            layoutId:   ev.scheduleId ?? null,
            campaignId: ev.campaignId ?? null,
            tag:        ev.tag ?? null,
            startedAt:  new Date(ev.startedAt),
            endedAt:    new Date(ev.endedAt),
            durationMs: ev.durationMs,
          },
        });
        accepted++;
      } catch {
        // Skip malformed rows; don't fail the whole batch
      }
    }

    // Update device heartbeat
    await db.device.update({
      where: { id: device.id },
      data:  { lastSeen: new Date(), status: 'ONLINE' },
    });

    return NextResponse.json({ accepted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
