// PATCH  /api/coupons/[id] — update a coupon (toggle active, edit fields) (admin)
// DELETE /api/coupons/[id] — delete a coupon (admin)
// Auth: requireAdmin — admin/ops session, or the legacy admin-password header.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;

  try {
    const body = await req.json() as {
      active?: boolean; value?: number; expiresAt?: string | null;
      maxRedemptions?: number | null; note?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.active === 'boolean') data.active = body.active;
    if (body.value != null) {
      const v = Math.floor(Number(body.value));
      if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: 'Invalid value.' }, { status: 400 });
      data.value = v;
    }
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.maxRedemptions !== undefined) {
      data.maxRedemptions = body.maxRedemptions != null && body.maxRedemptions > 0 ? Math.floor(body.maxRedemptions) : null;
    }
    if (body.note !== undefined) data.note = body.note?.trim() || null;

    const coupon = await db.coupon.update({ where: { id }, data });

    // A coupon edit moves real money off an invoice — log which fields changed
    // and the state they landed in. Dates are stringified: `meta` is a JSON
    // column, and a raw Date would make the (best-effort) write fail silently.
    await logAdminAction({
      actor, req,
      action: 'coupon.update',
      target: id,
      meta: {
        code:           coupon.code,
        changed:        Object.keys(data),
        active:         coupon.active,
        value:          coupon.value,
        expiresAt:      coupon.expiresAt?.toISOString() ?? null,
        maxRedemptions: coupon.maxRedemptions,
      },
    });

    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: 'Could not update coupon.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    // delete() returns the removed row, so the log can name the code that is
    // now gone — the id alone would be unrecognisable after the fact.
    const coupon = await db.coupon.delete({ where: { id } });

    await logAdminAction({
      actor, req,
      action: 'coupon.delete',
      target: id,
      meta:   { code: coupon.code, type: coupon.type, value: coupon.value },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete coupon.' }, { status: 500 });
  }
}
