// Daily proof-of-play archive sweep. The real schedule lives in
// .github/workflows/pop-export-cron.yml — vercel.json already carries the two
// cron entries the Hobby plan allows, so this one is GitHub Actions only.
//
// Daily on purpose, though exports are monthly/bi-monthly: the sweep is
// idempotent catch-up (runPopExportSweep exports the oldest completed period
// behind the watermark, or nothing). A missed firing costs a day of latency on
// a monthly deadline, never a gap in the archive. The same sweep also drives
// the deferred pruning pass, which has its own 45-day lag.
//
// GET /api/cron/pop-export
// Auth: CRON_SECRET bearer, same as device-health.

import { NextRequest, NextResponse } from 'next/server';
import { runPopExportSweep } from '@/lib/pop-export';
import { recordError, hashStack, getOrCreateCorrelationId } from '@/lib/telemetry';
import { isCronAuthorized } from '@/lib/cron-auth';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (!isCronAuthorized(auth)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPopExportSweep();
    // An export that ran but FAILED must fail the cron call — that is what
    // turns the Actions run red and gets a stalled archive noticed.
    if (result.export?.status === 'FAILED') {
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const err = error as Error;
    await recordError({
      route: '/api/cron/pop-export',
      errorClass: err.name || 'Error',
      message: err.message,
      stackHash: err.stack ? hashStack(err.stack) : undefined,
      correlationId: getOrCreateCorrelationId(null),
      actorType: 'system',
    }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
