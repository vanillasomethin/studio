// PATCH /api/devices/[id] — update storeName / groupName / storeId / orientation / playsOriginal
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

const VALID_ORIENTATIONS = ['LANDSCAPE', 'PORTRAIT', 'PORTRAIT_FLIPPED', 'AUTO'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json() as {
      storeName?:     string;
      groupName?:     string;
      storeId?:       string | null;
      orientation?:   string;
      playsOriginal?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (body.storeName?.trim()) data.name = body.storeName.trim();
    if (body.groupName !== undefined) data.groupName = body.groupName?.trim() || null;
    if ('storeId' in body) {
      data.storeId = body.storeId ?? null;
      data.linkedAt = body.storeId ? new Date() : null;
    }
    if (body.orientation && (VALID_ORIENTATIONS as readonly string[]).includes(body.orientation)) {
      data.orientation = body.orientation;
    }
    if (typeof body.playsOriginal === 'boolean') data.playsOriginal = body.playsOriginal;

    // Select explicitly. A bare update() returns every column, including
    // jwtSecret — the per-device signing key, with which anyone holding it can
    // mint that screen's token and impersonate it — plus pairingCode and
    // fcmToken. None of those belong in an API response, and an admin console
    // XSS or a proxy log would otherwise capture them.
    const raw = await db.device.update({
      where: { id },
      data,
      select: {
        id: true, name: true, groupName: true, storeId: true, linkedAt: true,
        orientation: true, playsOriginal: true, status: true, lastSeen: true,
        appVersion: true, androidVersion: true, uptimePctD30: true,
        cpuTempC: true, freeStorageMb: true, playbackAliveAt: true,
        bootedAt: true, pairedAt: true, claimedAt: true, updatedAt: true,
      },
    });
    const device = { ...raw, storeName: raw.name };
    return NextResponse.json({ device });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
