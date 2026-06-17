// GET /api/device/update-check
// Auth: Authorization: Bearer <device-jwt>
// Returns the latest released player APK version + download info for OTA.
// Configured via env vars set at release time (see CLAUDE.md "Env Vars"):
//   PLAYER_LATEST_VERSION_CODE, PLAYER_LATEST_VERSION_NAME, PLAYER_APK_URL, PLAYER_APK_SHA256
// The player compares versionCode against its own BuildConfig.VERSION_CODE — this
// route always reports the latest configured build, it doesn't know per-device state.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as jose from 'jose';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const deviceToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!deviceToken) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  try {
    const decoded = jose.decodeJwt(deviceToken);
    const deviceId = decoded.sub as string | undefined;
    if (!deviceId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const device = await db.device.findUnique({ where: { id: deviceId }, select: { id: true, jwtSecret: true } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await jose.jwtVerify(deviceToken, new TextEncoder().encode(device.jwtSecret));

    const versionCode = Number(process.env.PLAYER_LATEST_VERSION_CODE ?? 0);
    const apkUrl       = process.env.PLAYER_APK_URL ?? null;
    const sha256       = process.env.PLAYER_APK_SHA256 ?? null;

    if (!versionCode || !apkUrl || !sha256) {
      return NextResponse.json({ updateAvailable: false });
    }

    return NextResponse.json({
      updateAvailable: true,
      versionCode,
      versionName: process.env.PLAYER_LATEST_VERSION_NAME ?? null,
      apkUrl,
      sha256,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
