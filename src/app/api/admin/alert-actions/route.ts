// GET  /api/admin/alert-actions              — all alert action state (assignment/status) + comment counts
// POST /api/admin/alert-actions { alertId, action: 'assign'|'close'|'reopen', team?, assignee?, closedBy? }
//
// Separate path from /api/admin/alerts, which serves main's screen-offline alert
// feed — these are two different things that both used to answer on that URL.
//
// Alerts themselves are computed at read time from live device/store/campaign data
// (see AlertsTab.buildAlerts on the client) — they have no row of their own. This
// route holds the durable, team-visible state layered on top of a computed alert,
// keyed by its deterministic client-side id. Auth: admin-password header.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { db } from '@/lib/db';

const TEAMS = new Set(['tech', 'operations', 'marketing']);

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const [actions, commentCounts] = await Promise.all([
    db.alertAction.findMany(),
    db.alertComment.groupBy({ by: ['alertId'], _count: { id: true } }),
  ]);
  const countByAlert = new Map(commentCounts.map((c) => [c.alertId, c._count.id]));

  return NextResponse.json({
    actions: actions.map((a) => ({
      alertId: a.alertId,
      team: a.team,
      assignee: a.assignee,
      status: a.status,
      closedAt: a.closedAt?.toISOString() ?? null,
      closedBy: a.closedBy,
      commentCount: countByAlert.get(a.alertId) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as {
    alertId?: string; action?: string; team?: string | null; assignee?: string | null; closedBy?: string;
  } | null;
  const alertId = body?.alertId?.trim();
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 });

  let data: Record<string, unknown>;
  switch (body?.action) {
    case 'assign': {
      const team = body.team || null;
      if (team && !TEAMS.has(team)) return NextResponse.json({ error: 'Invalid team' }, { status: 400 });
      data = { team, assignee: body.assignee?.trim() || null };
      break;
    }
    case 'close':
      data = { status: 'closed', closedAt: new Date(), closedBy: body.closedBy?.trim() || null };
      break;
    case 'reopen':
      data = { status: 'open', closedAt: null, closedBy: null };
      break;
    default:
      return NextResponse.json({ error: "action must be 'assign', 'close' or 'reopen'" }, { status: 400 });
  }

  const row = await db.alertAction.upsert({
    where: { alertId },
    create: { alertId, ...data },
    update: data,
  });

  return NextResponse.json({
    alertId: row.alertId,
    team: row.team,
    assignee: row.assignee,
    status: row.status,
    closedAt: row.closedAt?.toISOString() ?? null,
    closedBy: row.closedBy,
  });
}
