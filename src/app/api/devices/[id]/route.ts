// PATCH /api/devices/[id] — update storeName / groupName / storeId / orientation / playsOriginal
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const VALID_ORIENTATIONS = ['LANDSCAPE', 'PORTRAIT', 'PORTRAIT_FLIPPED', 'AUTO'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
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

    // Re-pointing a screen at a different store is what moves paid impressions
    // from one partner's payout to another's, so record which fields moved and
    // where they landed. Values come from the persisted row, not the request body.
    await logAdminAction({
      actor, req,
      action: 'device.update',
      target: id,
      meta: {
        fields:        Object.keys(data),
        storeName:     raw.name,
        groupName:     raw.groupName,
        storeId:       raw.storeId,
        orientation:   raw.orientation,
        playsOriginal: raw.playsOriginal,
      },
    });

    return NextResponse.json({ device });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
