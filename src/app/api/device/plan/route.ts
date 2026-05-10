// Device plan — returns the active schedule + content manifest for the next 72 hours.
// Player polls this every 72 h (Xibo-style). On change: md5 differs → re-download.
//
// GET /api/device/plan
// Auth: Authorization: Bearer <device-jwt>
// Returns: { planHash, validUntil, items: [{ contentId, objectKey, md5, type, durationMs, order }] }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyDeviceToken } from '@/lib/device-auth';
import { publicUrl } from '@/lib/r2';
import crypto from 'crypto';

async function authenticate(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  // We need the device to look up its secret — first decode sub without verifying
  // (safe because we verify immediately after with the correct secret)
  const parts  = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const deviceId = payload?.sub as string | undefined;
    if (!deviceId) return null;

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) return null;

    const { verifyDeviceToken: verify } = await import('@/lib/device-auth');
    const result = await verify(token, device.jwtSecret);
    if (!result) return null;

    return device;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const device = await authenticate(req);
  if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now       = new Date();
  const windowEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  try {
    // Find schedules active in the next 72-hr window for this device or its group
    const schedules = await db.schedule.findMany({
      where: {
        startAt: { lte: windowEnd },
        endAt:   { gte: now },
        OR: [
          { deviceIds: { has: device.id } },
          ...(device.groupName ? [{ groupName: device.groupName }] : []),
        ],
      },
      include: {
        playlist: {
          include: {
            items: {
              include: { content: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { startAt: 'asc' }],
      take: 1, // highest-priority schedule wins (Xibo pattern)
    });

    const schedule = schedules[0];
    const items = schedule?.playlist.items.map((item) => ({
      contentId:  item.content.id,
      objectKey:  item.content.objectKey,
      url:        publicUrl(item.content.objectKey),
      md5:        item.content.md5,
      type:       item.content.type,
      durationMs: item.durationMs,
      order:      item.order,
    })) ?? [];

    // Hash the plan so the player can detect changes without re-downloading
    const planHash = crypto
      .createHash('md5')
      .update(JSON.stringify(items))
      .digest('hex');

    // Update device heartbeat
    await db.device.update({
      where: { id: device.id },
      data:  { lastSeen: now, status: 'ONLINE' },
    });

    return NextResponse.json({
      planHash,
      scheduleId: schedule?.id ?? null,
      validUntil: windowEnd.toISOString(),
      items,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
