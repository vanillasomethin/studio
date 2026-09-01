// POST /api/devices/[id]/command — push a remote command to a device over FCM.
// Equivalent to Xibo's XMR relay (collectNow/reboot/screenshot/etc pushed to players),
// but riding on FCM instead of a self-hosted ZeroMQ relay since Android already
// maintains that persistent, NAT-friendly connection for us.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pushCommand, type DeviceCommandType } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

// plan_updated is pushed automatically by schedule/playlist mutations (see fcm.ts
// callers) — this endpoint is for the two commands an admin triggers explicitly.
const ALLOWED_TYPES: DeviceCommandType[] = ['reboot', 'health_ping'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;

  let type: DeviceCommandType;
  try {
    const body = await req.json();
    if (!ALLOWED_TYPES.includes(body?.type)) {
      return NextResponse.json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }
    type = body.type;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const device = await db.device.findUnique({ where: { id }, select: { id: true } });
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  await pushCommand([id], type);
  // Was a bare auditLog.create with no actorId — a reboot nobody could be held to.
  // Routed through logAdminAction so the row carries who/ip/agent like every other
  // admin mutation, and so a DB hiccup on the log can't 500 a command that already shipped.
  await logAdminAction({
    actor, req,
    action: 'device.command',
    target: id,
    meta:   { type },
  });

  return NextResponse.json({ ok: true });
}
