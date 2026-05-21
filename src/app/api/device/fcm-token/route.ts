// POST /api/device/fcm-token
// Called by the APK (AliveMessagingService.onNewToken) when FCM assigns or rotates the device token.
// Auth: Bearer <deviceToken> (same JWT used for /api/device/plan)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const deviceToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!deviceToken) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  try {
    const { fcmToken } = await req.json() as { fcmToken?: string };
    if (!fcmToken || typeof fcmToken !== 'string') {
      return NextResponse.json({ error: 'fcmToken required' }, { status: 400 });
    }

    // Decode JWT header to find device — try each device's jwtSecret
    // We decode without verifying first to get the sub (deviceId) claim
    const decoded = jose.decodeJwt(deviceToken);
    const deviceId = decoded.sub as string | undefined;
    if (!deviceId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId }, select: { id: true, jwtSecret: true } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Verify token signature
    await jose.jwtVerify(deviceToken, new TextEncoder().encode(device.jwtSecret));

    await db.device.update({ where: { id: device.id }, data: { fcmToken } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
