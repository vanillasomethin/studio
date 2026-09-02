// Smart-plug power bookkeeping shared by the cron sweep, the admin panel and
// the partner-facing endpoint.
//
// Energy accounting: Tuya's add_ele counter has per-product units and reset
// quirks, so consumption is instead integrated from wattage — each poll writes
// the Wh spent since the previous poll (trapezoid over the gap, capped so a
// blind window is recorded as unknown rather than fabricated). Month/day totals
// are then a plain SUM(energyWh), gap-proof and unit-correct on any product.
//
// Freshness: mirrors the device-alerts philosophy — the 5-minute GitHub Actions
// loop is only the backstop, and any admin/partner page load re-polls a stale
// plug in-line, so a drifting scheduler can't blind the dashboards (see the
// offline-detection history in device-health-cron.yml).

import type { SmartPlug } from '@prisma/client';
import { db } from '@/lib/db';
import { getPowerSettings } from '@/lib/power-db';
import { getTuyaDevice, isTuyaConfigured, parsePlugStatus, type TuyaStatus } from '@/lib/tuya';

/** Reading older than this is re-polled in-line on page load. */
const STALE_AFTER_MS = 10 * 60 * 1000;
// A gap longer than this means the pollers were blind — integrate at most this
// much so an hours-long outage can't book hours of phantom consumption.
const MAX_INTEGRATION_GAP_MS = 15 * 60 * 1000;
/** Raw 5-minute readings are kept this long (≈52k rows per store). */
const RETENTION_DAYS = 180;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Atomically claim the right to record a poll for this plug: advance
 * lastPolledAt only if it still holds the value the caller read. Exactly one
 * of any set of racing writers (cron sweep, admin refresh, partner page load)
 * wins; the losers must skip, or the same gap's energy would be booked twice —
 * todayKwh/monthKwh are a plain SUM over PlugReading rows.
 */
async function claimPoll(plug: SmartPlug, now: Date): Promise<boolean> {
  const claimed = await db.smartPlug.updateMany({
    where: { id: plug.id, lastPolledAt: plug.lastPolledAt },
    data: { lastPolledAt: now },
  });
  return claimed.count === 1;
}

/**
 * Record one observation of a plug: update the snapshot columns, append a
 * PlugReading with the integrated Wh, and prune expired readings. Returns the
 * updated plug row, or null when a concurrent writer already recorded this
 * window (`preclaimed` skips the claim for callers who took it themselves).
 */
export async function recordPlugPoll(
  plug: SmartPlug,
  observed: { online: boolean; name?: string | null; status?: TuyaStatus[] },
  now: Date = new Date(),
  preclaimed = false,
): Promise<SmartPlug | null> {
  if (!preclaimed && !(await claimPoll(plug, now))) return null;
  const scales = (plug.scales ?? undefined) as Record<string, number> | undefined;
  const parsed = observed.online
    ? parsePlugStatus(observed.status, scales)
    : { switchOn: false, socketsOn: 0, socketCount: plug.socketCount ?? 0, powerW: null, voltageV: null, currentA: null };

  // Trapezoid over the capped gap. Both endpoints must be real online wattage
  // readings — an offline edge contributes nothing rather than a guess.
  let energyWh: number | null = null;
  if (observed.online && parsed.powerW != null) {
    energyWh = 0;
    if (plug.lastPolledAt && plug.online && plug.powerW != null) {
      const gapMs = Math.min(now.getTime() - plug.lastPolledAt.getTime(), MAX_INTEGRATION_GAP_MS);
      if (gapMs > 0) energyWh = ((plug.powerW + parsed.powerW) / 2) * (gapMs / 3_600_000);
    }
  }

  const [updated] = await db.$transaction([
    db.smartPlug.update({
      where: { id: plug.id },
      data: {
        online: observed.online,
        switchOn: parsed.switchOn,
        socketsOn: parsed.socketsOn,
        socketCount: parsed.socketCount || plug.socketCount,
        powerW: parsed.powerW,
        voltageV: parsed.voltageV,
        currentA: parsed.currentA,
        ...(observed.name ? { name: observed.name } : {}),
        lastPolledAt: now,
      },
    }),
    db.plugReading.create({
      data: {
        plugId: plug.id,
        at: now,
        online: observed.online,
        switchOn: parsed.switchOn,
        powerW: parsed.powerW,
        energyWh,
      },
    }),
    db.plugReading.deleteMany({
      where: { plugId: plug.id, at: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 3_600_000) } },
    }),
  ]);
  return updated;
}

/**
 * Re-poll a plug from Tuya if its snapshot is stale (or `force`). Best-effort:
 * any cloud failure returns the plug as-is — a dashboards read must never 500
 * because Tuya hiccuped.
 *
 * The claim is taken BEFORE the cloud call, so N simultaneous page loads on a
 * stale snapshot produce one Tuya request, not N — and because a failed call
 * has still consumed the claim, a persistently erroring device is retried at
 * most once per staleness window instead of on every page load.
 */
export async function refreshPlugIfStale(plug: SmartPlug, force = false): Promise<SmartPlug> {
  if (!isTuyaConfigured()) return plug;
  const fresh = plug.lastPolledAt && Date.now() - plug.lastPolledAt.getTime() < STALE_AFTER_MS;
  if (fresh && !force) return plug;
  const now = new Date();
  if (!(await claimPoll(plug, now))) {
    // Another request or the cron won this window — hand back their result.
    return (await db.smartPlug.findUnique({ where: { id: plug.id } })) ?? plug;
  }
  try {
    const device = await getTuyaDevice(plug.tuyaDeviceId);
    return (await recordPlugPoll(plug, { online: !!device.online, name: device.name, status: device.status }, now, true)) ?? plug;
  } catch {
    return { ...plug, lastPolledAt: now };
  }
}

// ─── Summaries ───────────────────────────────────────────────────────────────

export type PlugPowerSummary = {
  linked: true;
  name: string;
  online: boolean | null;
  switchOn: boolean | null;
  socketsOn: number | null;
  socketCount: number | null;
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
  lastPolledAt: string | null;
  todayKwh: number;
  monthKwh: number;
  /** ₹-estimate helpers — display as an estimate, billing follows the meter. */
  ratePaisePerKwh: number;
  estMonthCostPaise: number;
  /** Avg draw per hour over the last 24h (online readings only). */
  hourly24: { hour: string; avgW: number | null }[];
  /** Consumption per complete IST day (today partial), oldest first, ≤7 days. */
  daily7: { day: string; kwh: number }[];
};

/** Start of the current IST day / month, as UTC instants. */
function istDayStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}
function istMonthStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}
/** "YYYY-MM-DD" of an instant, in IST. */
function istDayKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export async function plugPowerSummary(plug: SmartPlug, now: Date = new Date()): Promise<PlugPowerSummary> {
  const dayStart = istDayStart(now);
  const monthStart = istMonthStart(now);
  // Aligned to the IST day boundary 6 days back, so daily7 holds at most 7
  // buckets and every bucket but today covers a COMPLETE day — a rolling
  // now-168h window would add an 8th, partial (and so spuriously low) day.
  const windowStart = new Date(dayStart.getTime() - 6 * 24 * 3_600_000);

  // Tariff comes from the same PlayerConfig knob the proof-of-play ESTIMATE
  // uses (getPowerSettings) — measured and estimated ₹ figures must never
  // disagree on the rate, only on the kWh they price.
  const [todayAgg, monthAgg, recent, { paisePerKwh: rate }] = await Promise.all([
    db.plugReading.aggregate({ _sum: { energyWh: true }, where: { plugId: plug.id, at: { gte: dayStart } } }),
    db.plugReading.aggregate({ _sum: { energyWh: true }, where: { plugId: plug.id, at: { gte: monthStart } } }),
    db.plugReading.findMany({
      where: { plugId: plug.id, at: { gte: windowStart } },
      orderBy: { at: 'asc' },
      select: { at: true, online: true, powerW: true, energyWh: true },
    }),
    getPowerSettings(),
  ]);

  // Hourly average draw, last 24h. Buckets with no online reading stay null so
  // the chart shows "no data" rather than a convincing zero.
  const dayAgo = now.getTime() - 24 * 3_600_000;
  const hourly = new Map<number, { sum: number; n: number }>();
  for (const r of recent) {
    if (r.at.getTime() < dayAgo || !r.online || r.powerW == null) continue;
    const bucket = Math.floor(r.at.getTime() / 3_600_000) * 3_600_000;
    const cur = hourly.get(bucket) ?? { sum: 0, n: 0 };
    cur.sum += r.powerW; cur.n += 1;
    hourly.set(bucket, cur);
  }
  const hourly24: PlugPowerSummary['hourly24'] = [];
  const firstBucket = Math.floor(dayAgo / 3_600_000) * 3_600_000 + 3_600_000;
  for (let b = firstBucket; b <= now.getTime(); b += 3_600_000) {
    const cur = hourly.get(b);
    hourly24.push({ hour: new Date(b).toISOString(), avgW: cur ? Math.round((cur.sum / cur.n) * 10) / 10 : null });
  }

  const daily = new Map<string, number>();
  for (const r of recent) {
    if (r.energyWh == null) continue;
    const key = istDayKey(r.at);
    daily.set(key, (daily.get(key) ?? 0) + r.energyWh);
  }
  const daily7 = [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, wh]) => ({ day, kwh: Math.round(wh / 10) / 100 }));

  const monthKwh = Math.round((monthAgg._sum.energyWh ?? 0) / 10) / 100;
  return {
    linked: true,
    name: plug.name,
    online: plug.online,
    switchOn: plug.switchOn,
    socketsOn: plug.socketsOn,
    socketCount: plug.socketCount,
    powerW: plug.powerW,
    voltageV: plug.voltageV,
    currentA: plug.currentA,
    lastPolledAt: plug.lastPolledAt?.toISOString() ?? null,
    todayKwh: Math.round((todayAgg._sum.energyWh ?? 0) / 10) / 100,
    monthKwh,
    ratePaisePerKwh: rate,
    estMonthCostPaise: Math.round(monthKwh * rate),
    hourly24,
    daily7,
  };
}
