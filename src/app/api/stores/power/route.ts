// GET /api/stores/power?storeId=…&month=YYYY-MM
// Store partner's electricity picture for the screen we installed — both the
// proof-of-play ESTIMATE (always present) and, when an Aziot/Tuya smart plug is
// linked to the store, the METERED reading from the socket.
// Auth: store-partner pattern — resolveStoreId, never auth()-gated (see CLAUDE.md).
//
// estimate: on-hours are measured from proof-of-play; watts and tariff are
// assumptions (see lib/power.ts), so the response carries both so the partner
// can check the arithmetic against their own bill.
//
// plug: an explicit ALLOWLIST projected from the shared summary — never the
// summary spread whole. The full PlugPowerSummary carries ops-only fields (the
// Smart Life device name is an internal label, voltage/current/socket telemetry,
// the hourly/daily series), and projecting here means a field added for the
// admin panel can never silently ship to partners. A stale snapshot triggers an
// in-line best-effort re-poll; refreshPlugIfStale atomically claims the poll
// window first, so N parallel requests cost one Tuya call and an authenticated
// partner can't hammer the Tuya API through their own dashboard. Both blocks
// price kWh with the same PlayerConfig tariff.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { estimateStorePower } from '@/lib/power-db';
import { istMonthStart } from '@/lib/power';
import { plugPowerSummary, refreshPlugIfStale } from '@/lib/tuya-power';

type PlugBlock =
  | { linked: false }
  | {
      linked: true;
      online: boolean | null;
      powerW: number | null;
      todayKwh: number;
      monthKwh: number;
      estMonthCostPaise: number;
      lastPolledAt: string | null;
    };

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

    // Metered block — best-effort: a Tuya hiccup degrades to the last snapshot,
    // and a store with no linked plug just gets { linked: false }.
    let plug: PlugBlock = { linked: false };
    const plugRow = await db.smartPlug.findUnique({ where: { storeId } });
    if (plugRow) {
      const current = await refreshPlugIfStale(plugRow);
      const s = await plugPowerSummary(current);
      plug = {
        linked: true,
        online: s.online,
        powerW: s.powerW,
        todayKwh: s.todayKwh,
        monthKwh: s.monthKwh,
        estMonthCostPaise: s.estMonthCostPaise,
        lastPolledAt: s.lastPolledAt,
      };
    }

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
      plug,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
