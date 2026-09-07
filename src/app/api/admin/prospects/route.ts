// Prospect locations — spots ALIVE is considering, for review and study.
//
//   GET    /api/admin/prospects            → all of them, newest first
//   POST   /api/admin/prospects            → add one { label, lat, lng, … }
//   PATCH  /api/admin/prospects            → edit one { id, …fields }
//   DELETE /api/admin/prospects?id=…       → remove one
//
// Admin-only, and deliberately so: a Store with a pin appears on the public map
// the moment it is pinned, which is why prospects are a separate table. Nothing
// here is ever exposed to a public route — putting scouting notes on the
// marketing site would advertise shops that have agreed to nothing.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { db } from '@/lib/db';

export const PROSPECT_STATUSES = ['scouting', 'contacted', 'negotiating', 'rejected', 'converted'] as const;
type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

const isStatus = (v: unknown): v is ProspectStatus =>
  typeof v === 'string' && (PROSPECT_STATUSES as readonly string[]).includes(v);

type Body = {
  id?: string;
  label?: string;
  lat?: number;
  lng?: number;
  locality?: string | null;
  city?: string | null;
  notes?: string | null;
  status?: string;
  storeId?: string | null;
};

/** Leaflet throws on a bad LatLng, and one bad row would take the whole map
 *  down — so a point that is not a real point never gets stored. */
function badPoint(lat: unknown, lng: unknown): boolean {
  return !Number.isFinite(lat as number) || !Number.isFinite(lng as number)
    || Math.abs(lat as number) > 90 || Math.abs(lng as number) > 180;
}

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const prospects = await db.prospectLocation.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    prospects: prospects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as Body | null;
  const label = body?.label?.trim();
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 });
  if (badPoint(body?.lat, body?.lng)) {
    return NextResponse.json({ error: 'lat/lng must be a real coordinate' }, { status: 400 });
  }
  if (body?.status !== undefined && !isStatus(body.status)) {
    return NextResponse.json({ error: `status must be one of ${PROSPECT_STATUSES.join(', ')}` }, { status: 400 });
  }

  const prospect = await db.prospectLocation.create({
    data: {
      label,
      lat: body!.lat!, lng: body!.lng!,
      locality: body?.locality?.trim() || null,
      city:     body?.city?.trim() || null,
      notes:    body?.notes?.trim() || null,
      status:   body?.status ?? 'scouting',
      // Recorded from the session, not from the body — same reason the audit
      // trail exists at all.
      createdBy: actor.label,
    },
  });

  await logAdminAction({
    actor, req, action: 'prospect.create', target: prospect.id,
    // No key containing "pin" — logAdminAction scrubs those (see admin-audit).
    meta: { label, coords: `${prospect.lat},${prospect.lng}`, status: prospect.status },
  });
  return NextResponse.json({ prospect });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as Body | null;
  const id = body?.id?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (body?.status !== undefined && !isStatus(body.status)) {
    return NextResponse.json({ error: `status must be one of ${PROSPECT_STATUSES.join(', ')}` }, { status: 400 });
  }
  if ((body?.lat !== undefined || body?.lng !== undefined) && badPoint(body?.lat, body?.lng)) {
    return NextResponse.json({ error: 'lat/lng must be a real coordinate' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body?.label    !== undefined) data.label    = body.label.trim();
  if (body?.lat      !== undefined) data.lat      = body.lat;
  if (body?.lng      !== undefined) data.lng      = body.lng;
  if (body?.locality !== undefined) data.locality = body.locality?.trim() || null;
  if (body?.city     !== undefined) data.city     = body.city?.trim() || null;
  if (body?.notes    !== undefined) data.notes    = body.notes?.trim() || null;
  if (body?.status   !== undefined) data.status   = body.status;
  if (body?.storeId  !== undefined) data.storeId  = body.storeId || null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const prospect = await db.prospectLocation.update({ where: { id }, data });
  await logAdminAction({ actor, req, action: 'prospect.update', target: id, meta: data });
  return NextResponse.json({ prospect });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.prospectLocation.delete({ where: { id } });
  await logAdminAction({ actor, req, action: 'prospect.delete', target: id });
  return NextResponse.json({ ok: true });
}
