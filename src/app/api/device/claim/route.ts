// Device claim — called once when an Android TV player boots for the first time.
// Creates a Device record and returns a per-device JWT for all future requests.
//
// POST /api/device/claim
// Body: { hardwareKey: string, name?: string, groupName?: string }
// Returns: { deviceId, token }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signDeviceToken } from '@/lib/device-auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { hardwareKey, name, groupName } = await req.json() as {
      hardwareKey: string;
      name?:       string;
      groupName?:  string;
    };

    if (!hardwareKey?.trim()) {
      return NextResponse.json({ error: 'hardwareKey is required' }, { status: 400 });
    }

    // Idempotent — return existing device token if already claimed
    let device = await db.device.findUnique({ where: { hardwareKey } });

    if (!device) {
      const jwtSecret = crypto.randomBytes(32).toString('hex');
      device = await db.device.create({
        data: {
          hardwareKey,
          name:      name ?? hardwareKey.slice(0, 12),
          groupName: groupName ?? null,
          jwtSecret,
          status:    'PENDING',
        },
      });
    }

    const token = await signDeviceToken(device.id, device.jwtSecret);

    return NextResponse.json({ deviceId: device.id, token });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
