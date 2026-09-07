// "Export now" — runs the same idempotent sweep the cron runs, from the admin
// panel. `force` bypasses only the enabled flag (so the button works while
// auto-export is off), never the watermark: if every completed period is
// already archived this returns { skipped: 'up-to-date' } and uploads nothing.
// POST /api/admin/pop-export/run

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { runPopExportSweep } from '@/lib/pop-export';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const result = await runPopExportSweep({ force: true });

    await logAdminAction({
      actor, req,
      action: 'pop_export.run',
      target: result.export?.periodLabel ?? result.skipped ?? 'sweep',
      meta: {
        status: result.export?.status ?? 'skipped',
        plays: result.export?.playCount ?? 0,
        prunedPeriods: result.pruned.length,
      },
    });

    return NextResponse.json(result, { status: result.export?.status === 'FAILED' ? 500 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
