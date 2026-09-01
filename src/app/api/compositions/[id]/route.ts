// GET    /api/compositions/[id]
// PATCH  /api/compositions/[id]
// DELETE /api/compositions/[id]
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const { id } = await params;
  try {
    const composition = await db.composition.findUnique({ where: { id } });
    if (!composition) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ composition });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const body = await req.json() as {
      name?:        string;
      description?: string;
      zones?:       unknown;
    };
    const data: Record<string, unknown> = {};
    if (body.name?.trim()) data.name = body.name.trim();
    if ('description' in body) data.description = body.description?.trim() || null;
    if (Array.isArray(body.zones)) data.zones = body.zones;

    const composition = await db.composition.update({ where: { id }, data });

    // Zones decide what renders where on a screen, so log which fields moved —
    // the zone array itself stays out of the trail (bulky, not credential-safe
    // to assume), only its size.
    await logAdminAction({
      actor, req,
      action: 'composition.update',
      target: id,
      meta: {
        fields: Object.keys(data),
        name:   composition.name,
        ...(Array.isArray(body.zones) ? { zoneCount: body.zones.length } : {}),
      },
    });

    return NextResponse.json({ composition });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    // delete() returns the row it removed — the only chance to record what was
    // destroyed, since nothing can look it up afterwards.
    const deleted = await db.composition.delete({ where: { id } });

    await logAdminAction({
      actor, req,
      action: 'composition.delete',
      target: id,
      meta:   { name: deleted.name, isPreset: deleted.isPreset },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
