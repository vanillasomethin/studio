// DB-backed electricity estimation. Split from lib/power.ts so the arithmetic there
// stays pure and unit-testable.

import { db } from '@/lib/db';
import { estimatePower, istMonthStart, type PowerEstimate } from '@/lib/power';

export async function getPowerSettings(): Promise<{ defaultWatts: number; paisePerKwh: number }> {
  const cfg = await db.playerConfig.findUnique({
    where:  { id: 1 },
    select: { defaultScreenWatts: true, electricityPaisePerKwh: true },
  });
  return {
    defaultWatts: cfg?.defaultScreenWatts     ?? 60,
    paisePerKwh:  cfg?.electricityPaisePerKwh ?? 800,
  };
}

/**
 * Estimates each store's electricity use since `since` (default: start of the current
 * IST month) from its devices' hourly proof-of-play buckets.
 *
 * A store with several devices sums across them — the buckets are per device, and each
 * screen draws its own power. Stores whose screens never reported come back with zero
 * on-hours rather than being omitted, so the caller can tell "no usage" apart from
 * "store not found".
 */
export async function estimateStorePower(
  stores: { id: string; screenWatts: number | null }[],
  since: Date = istMonthStart(),
): Promise<Map<string, PowerEstimate>> {
  const out = new Map<string, PowerEstimate>();
  if (stores.length === 0) return out;

  const { defaultWatts, paisePerKwh } = await getPowerSettings();

  const devices = await db.device.findMany({
    where:  { storeId: { in: stores.map((s) => s.id) } },
    select: { id: true, storeId: true },
  });
  const storeOfDevice = new Map(devices.map((d) => [d.id, d.storeId!]));

  const buckets = devices.length
    ? await db.hourlyPop.findMany({
        where:  { deviceId: { in: devices.map((d) => d.id) }, hour: { gte: since } },
        select: { deviceId: true, totalMs: true },
      })
    : [];

  const byStore = new Map<string, { totalMs: number }[]>();
  for (const b of buckets) {
    const storeId = storeOfDevice.get(b.deviceId);
    if (!storeId) continue;
    const list = byStore.get(storeId) ?? [];
    list.push({ totalMs: b.totalMs });
    byStore.set(storeId, list);
  }

  // Stores with a linked smart plug use the average draw the socket actually
  // measured while on (this period) instead of the surveyed/default wattage —
  // see estimatePower's source field. Off/standby readings are excluded so a
  // screen that idles overnight doesn't drag the running figure down.
  const plugs = await db.smartPlug.findMany({
    where:  { storeId: { in: stores.map((s) => s.id) } },
    select: { id: true, storeId: true },
  });
  const meteredByStore = new Map<string, number>();
  if (plugs.length > 0) {
    const avgs = await db.plugReading.groupBy({
      by:     ['plugId'],
      where:  {
        plugId:   { in: plugs.map((p) => p.id) },
        at:       { gte: since },
        switchOn: true,
        powerW:   { not: null },
      },
      _avg: { powerW: true },
    });
    const storeOfPlug = new Map(plugs.map((p) => [p.id, p.storeId]));
    for (const a of avgs) {
      const storeId = storeOfPlug.get(a.plugId);
      const w = a._avg.powerW;
      if (storeId && w != null && w >= 1) meteredByStore.set(storeId, Math.round(w));
    }
  }

  for (const s of stores) {
    out.set(s.id, estimatePower({
      buckets:      byStore.get(s.id) ?? [],
      storeWatts:   s.screenWatts,
      defaultWatts,
      paisePerKwh,
      meteredWatts: meteredByStore.get(s.id) ?? null,
    }));
  }
  return out;
}
