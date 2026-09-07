// Proof-of-play archive settings + history — powers the "Monthly archive" panel
// on the admin Proof of Play tab.
// GET   /api/admin/pop-export → { config, exports, next }
// PATCH /api/admin/pop-export → { config }   (enabled / frequency / deleteAfterExport)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { getOrCreatePopExportConfig, pendingPeriod } from '@/lib/pop-export';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const config = await getOrCreatePopExportConfig();
    const exports = await db.popExport.findMany({
      orderBy: { periodStart: 'desc' },
      take: 24,
    });

    // What the next run will cover, and whether it is already due — the panel
    // shows this so "why hasn't it exported yet" is answerable at a glance.
    let earliest: Date | null = null;
    if (!config.exportedThrough) {
      const first = await db.playEvent.findFirst({ orderBy: { startedAt: 'asc' }, select: { startedAt: true } });
      earliest = first?.startedAt ?? null;
    }
    const span = config.frequency === 'BIMONTHLY' ? 2 : 1;
    const due = pendingPeriod(config.exportedThrough, earliest, span, new Date());
    // Far-future probe: the same period boundaries even when not yet due.
    const upcoming = due ?? pendingPeriod(config.exportedThrough, earliest, span, new Date(Date.now() + span * 32 * 86_400_000));

    return NextResponse.json({
      config,
      exports,
      next: upcoming ? { periodLabel: upcoming.label, periodEnd: upcoming.end.toISOString(), due: !!due } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as {
      enabled?: boolean;
      frequency?: string;
      deleteAfterExport?: boolean;
    };

    const data: { enabled?: boolean; frequency?: 'MONTHLY' | 'BIMONTHLY'; deleteAfterExport?: boolean } = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.deleteAfterExport === 'boolean') data.deleteAfterExport = body.deleteAfterExport;
    if (body.frequency !== undefined) {
      if (body.frequency !== 'MONTHLY' && body.frequency !== 'BIMONTHLY') {
        return NextResponse.json({ error: 'frequency must be MONTHLY or BIMONTHLY' }, { status: 400 });
      }
      data.frequency = body.frequency;
    }

    await getOrCreatePopExportConfig();
    const config = await db.popExportConfig.update({ where: { id: 1 }, data });

    // deleteAfterExport arms deletion of business records — always record the
    // resulting state, not just which fields moved.
    await logAdminAction({
      actor, req,
      action: 'pop_export.config',
      target: 'pop-export',
      meta: {
        changed: Object.keys(data),
        enabled: config.enabled,
        frequency: config.frequency,
        deleteAfterExport: config.deleteAfterExport,
      },
    });

    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
