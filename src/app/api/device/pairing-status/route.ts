// GET /api/device/pairing-status
// Called by the player every few seconds while waiting for admin confirmation.
// Auth: Bearer device JWT
// Returns: { paired: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const { verifyDeviceToken } = await import('@/lib/device-auth');
    const result = await verifyDeviceToken(token, device.jwtSecret);
    if (!result) return null;

    return device;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const device = await authenticate(req);
  if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ paired: device.pairedAt !== null });
}
