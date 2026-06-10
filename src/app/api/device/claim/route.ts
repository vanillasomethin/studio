// Device claim — called once when an Android TV player boots for the first time.
// Creates a Device record and returns a per-device JWT for all future requests.
//
// POST /api/device/claim
// Body: { hardwareKey: string, name?: string, groupName?: string }
// Returns: { deviceId, token, pairingCode }
//   pairingCode: 6-char code to display on TV; empty string if device already admin-confirmed

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrCreateCorrelationId, hashStack, recordError } from '@/lib/telemetry';
import { signDeviceToken } from '@/lib/device-auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req.headers.get('x-correlation-id'));
  const route = '/api/device/claim';
  try {
    const { hardwareKey, name, groupName, storeReferralCode } = await req.json() as {
      hardwareKey:        string;
      name?:              string;
      groupName?:         string;
      storeReferralCode?: string;
    };

    if (!hardwareKey?.trim()) {
      return NextResponse.json({ error: 'hardwareKey is required' }, { status: 400 });
    }

    // Resolve store from referral code if provided
    let storeId: string | null = null;
    if (storeReferralCode?.trim()) {
      const store = await db.store.findFirst({ where: { referralCode: storeReferralCode.trim() }, select: { id: true } });
      if (store) storeId = store.id;
    }

    // Generate a 6-char uppercase hex pairing code
    const newPairingCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

    // Idempotent — return existing device token if already claimed
    let device = await db.device.findUnique({ where: { hardwareKey } });

    if (!device) {
      const jwtSecret   = crypto.randomBytes(32).toString('hex');
      const pairingCode = newPairingCode();
      device = await db.device.create({
        data: {
          hardwareKey,
          name:      name ?? hardwareKey.slice(0, 12),
          groupName: groupName ?? null,
          jwtSecret,
          status:    'PENDING',
          pairingCode,
          // pairedAt intentionally null — set by admin after entering the on-screen code
          ...(storeId ? { storeId, linkedAt: new Date() } : {}),
        },
      });
    } else if (storeId && !device.storeId) {
      // Auto-link if code provided on re-claim and device not yet linked
      device = await db.device.update({
        where: { id: device.id },
        data:  { storeId, linkedAt: new Date() },
      });
    }

    const token = await signDeviceToken(device.id, device.jwtSecret);

    // Return pairingCode so the player displays it on screen.
    // Empty string means device is already admin-confirmed (pairedAt is set).
    return NextResponse.json({
      deviceId:    device.id,
      token,
      pairingCode: device.pairedAt ? '' : (device.pairingCode ?? ''),
    });
  } catch (e) {
    const error = e as Error;
    await recordError({ route, errorClass: error.name, message: error.message, stackHash: hashStack(error.stack), requestMeta: { correlationId, method: req.method }, actorType: 'device', correlationId });
    return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
  }
}
