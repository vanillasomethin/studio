// Screen-offline alerts for the admin panel.
//   GET   → open alerts (newest first) + unread count, for the popup + bell badge
//   PATCH → mark alerts read ({ ids: string[] } or { all: true })
//
// Auth: requireAdmin — named ADMIN/OPS session or the legacy shared password.
// Fail-closed either way: this route exposes store names and mutates state, so
// an unset env var and no session must lock it down, not open it up.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  try {
    // Resolved alerts stay visible briefly so an admin watching the panel sees
    // "came back online" rather than the alert just vanishing.
    const recentlyResolved = new Date(Date.now() - 60 * 60 * 1000);
    const alerts = await db.deviceAlert.findMany({
      where: {
        OR: [
          { status: 'OPEN' },
          { status: 'RESOLVED', resolvedAt: { gte: recentlyResolved } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unread = alerts.filter((a) => a.status === 'OPEN' && !a.adminReadAt).length;
    return NextResponse.json({ alerts, unread });
  } catch {
    // Table not migrated yet — an empty list keeps the panel working.
    return NextResponse.json({ alerts: [], unread: 0 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  try {
    const body = await req.json().catch(() => ({})) as { ids?: string[]; all?: boolean };
    const now = new Date();

    if (body.all) {
      const res = await db.deviceAlert.updateMany({ where: { adminReadAt: null }, data: { adminReadAt: now } });
      // Dismissing alerts is how an outage stops being visible on the bell badge,
      // so who cleared them (and how many) is worth having after the fact.
      await logAdminAction({
        actor, req,
        action: 'alert.mark_read',
        target: null,
        meta:   { all: true, count: res.count },
      });
      return NextResponse.json({ ok: true });
    }
    if (Array.isArray(body.ids) && body.ids.length) {
      const res = await db.deviceAlert.updateMany({ where: { id: { in: body.ids } }, data: { adminReadAt: now } });
      await logAdminAction({
        actor, req,
        action: 'alert.mark_read',
        target: body.ids.length === 1 ? body.ids[0] : null,
        meta:   { count: res.count, ids: body.ids.slice(0, 20) },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'ids or all required' }, { status: 400 });
  } catch (e) {
    console.error('admin/alerts PATCH failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not update alerts' }, { status: 500 });
  }
}
