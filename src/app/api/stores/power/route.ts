// GET /api/stores/power?storeId=…&month=YYYY-MM
// Store partner's own electricity estimate for the screen we installed.
// Auth: store-partner pattern — resolveStoreId, never auth()-gated (see CLAUDE.md).
//
// Returns an ESTIMATE. on-hours are measured from proof-of-play; watts and tariff are
// assumptions (see lib/power.ts), so the response carries both so the partner can
// check the arithmetic against their own bill.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { estimateStorePower } from '@/lib/power-db';
import { istMonthStart } from '@/lib/power';

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const store = await db.store.findUnique({
      where:  { id: storeId },
      select: {
        id: true, screenWatts: true, screenModel: true,
        screenPlatePhotoUrl: true, screenRatingPhotoUrl: true,
      },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const monthParam = req.nextUrl.searchParams.get('month');
    const since = /^\d{4}-\d{2}$/.test(monthParam ?? '')
      ? new Date(`${monthParam}-01T00:00:00+05:30`)
      : istMonthStart();

    const estimates = await estimateStorePower([{ id: store.id, screenWatts: store.screenWatts }], since);
    const est = estimates.get(store.id)!;

    return NextResponse.json({
      since: since.toISOString(),
      estimate: {
        onHours:   Number(est.onHours.toFixed(1)),
        units:     Number(est.kwh.toFixed(2)),   // kWh — "units" on an Indian bill
        costPaise: est.costPaise,
        watts:     est.watts,
        paisePerKwh: est.paisePerKwh,
        usingDefaultWatts: est.usingDefaultWatts,
      },
      screen: {
        model:           store.screenModel,
        watts:           store.screenWatts,
        platePhotoUrl:   store.screenPlatePhotoUrl,
        ratingPhotoUrl:  store.screenRatingPhotoUrl,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
