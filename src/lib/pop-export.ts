// Proof-of-play archive — the engine behind Admin → Proof of Play → "Monthly archive".
//
// Every month (or every two months), the full PlayEvent detail for the completed
// IST calendar period is written to THREE CSVs in the private R2 bucket:
//   • plays        — every single play, every column, in tamper-chain order
//   • by-ad        — per (creative, campaign) rollup for brand billing
//   • by-screen    — per screen rollup for partner/uptime conversations
// then, if the admin has opted in, the archived rows are pruned from Postgres.
//
// Correctness spine:
//   • `PopExportConfig.exportedThrough` is a WATERMARK — a month-boundary UTC
//     instant; everything strictly before it is verifiably in R2. Each export
//     covers exactly [watermark, watermark + span months) and only advances the
//     watermark after every upload is re-read (HEAD) and byte-checked. Periods
//     therefore tile with no gap and no overlap — "a detailed entry of each
//     proof of play without missing anything" is this invariant, not a hope.
//   • The daily cron sweep is idempotent catch-up, not a scheduler: it exports
//     the oldest pending period if one has completed, else does nothing. GitHub
//     Actions drift (observed 0.4–11.4h on this repo) is harmless at a monthly
//     deadline.
//   • Pruning NEVER runs at export time. Rows are deleted only once their
//     period ended ≥ PRUNE_LAG_DAYS ago, because live code still reads recent
//     PlayEvents: device-health recomputes a rolling 30-day uptime from them,
//     and a store's electricity payout for month M is estimated from M's plays
//     until the StorePayment breakdown freezes (~10 working days after month
//     end, store-payout-db.ts). Deleting on the 1st would zero both. 45 days
//     clears the payout freeze and the uptime window with margin.
//
// Neither cadence nor R2 keys ever encode "now" — everything derives from the
// period, so a re-run after a crash overwrites the same objects idempotently.

import { db } from './db';
import { monthWindow, istMonthKey } from './store-payout';
import { putPrivateObject, headPrivateObject, isPrivateBucketConfigured } from './r2';
import { notifyAdminWA } from './notify';

export const PRUNE_LAG_DAYS = 45;
// Well above the biggest period the current fleet can produce, far below what
// would OOM/timeout one invocation. Counted BEFORE reading, so an oversized
// period fails loud in the admin history instead of dying mid-sweep.
const MAX_ROWS_PER_EXPORT = 500_000;
const READ_BATCH = 5_000;
// A RUNNING row older than this is a crashed invocation, not a live one.
const STALE_RUN_MS = 30 * 60 * 1000;
const KEY_PREFIX = 'pop-exports/';

const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, no DST

// Built with fromCharCode rather than string escapes so the source carries no
// control-character escapes at all (CR LF, and the C0 range for the cell guard).
const CRLF = String.fromCharCode(13, 10); // RFC-4180 line ending
const CTRL_RUN = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']+', 'g');

/** 'YYYY-MM-DD HH:MM:SS' of an instant, in IST — sortable in any spreadsheet. */
export function istStamp(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/** Month key arithmetic: addMonthKeys('2026-11', 2) → '2027-01'. */
export function addMonthKeys(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export type PopPeriod = {
  label: string;      // '2026-08' or '2026-07_2026-08'
  start: Date;        // inclusive UTC instant (IST month edge)
  end: Date;          // exclusive UTC instant (IST month edge)
};

/**
 * The oldest un-archived period, or null when nothing is due yet.
 *
 * `watermark` is the config's exportedThrough (always a month boundary);
 * `earliest` is the first PlayEvent ever, used only before the first export so
 * the archive starts at the beginning of recorded history. A period is due only
 * once `now` is past its end — the current month is never exported partially,
 * so the watermark can only ever sit on completed-month edges.
 */
export function pendingPeriod(
  watermark: Date | null,
  earliest: Date | null,
  spanMonths: number,
  now: Date,
): PopPeriod | null {
  const baseMonth = watermark ? istMonthKey(watermark) : earliest ? istMonthKey(earliest) : null;
  if (!baseMonth) return null;
  const lastMonth = addMonthKeys(baseMonth, spanMonths - 1);
  const end = monthWindow(lastMonth).end;
  if (now.getTime() < end.getTime()) return null;
  return {
    label: spanMonths === 1 ? baseMonth : `${baseMonth}_${lastMonth}`,
    start: monthWindow(baseMonth).start,
    end,
  };
}

// Same hardened cell as the NEFT bulk-export: control chars stripped, leading
// =+-@ formula-guarded, unconditional quoting. These files get opened in Excel
// and forwarded to brands — a crafted content/campaign name must not be able to
// shift columns or execute.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const flat = s.replace(CTRL_RUN, ' ').trim();
  const guarded = /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const row = (cells: unknown[]) => cells.map(csvCell).join(',');

export const POP_EXPORT_FILES = ['plays', 'byAd', 'byScreen'] as const;
export type PopExportFile = (typeof POP_EXPORT_FILES)[number];

export function exportObjectKey(label: string, file: PopExportFile): string {
  const suffix = file === 'plays' ? 'plays' : file === 'byAd' ? 'by-ad' : 'by-screen';
  return `${KEY_PREFIX}${label}/alive-pop-${suffix}_${label}.csv`;
}

export type PopExportSummary = {
  id: string;
  periodLabel: string;
  status: 'COMPLETED' | 'FAILED';
  playCount: number;
  screenCount: number;
  adCount: number;
  totalBytes: number;
  error: string | null;
};

export type PopSweepResult = {
  skipped?: 'disabled' | 'up-to-date' | 'already-running';
  export?: PopExportSummary;
  pruned: { periodLabel: string; deletedRows: number }[];
};

export async function getOrCreatePopExportConfig() {
  return db.popExportConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/**
 * One sweep = at most one period exported + at most a handful of periods
 * pruned. Called daily by the cron (gated on `enabled`) and on demand from the
 * admin panel (`force` ignores `enabled`, never the watermark).
 */
export async function runPopExportSweep(opts: { force?: boolean } = {}): Promise<PopSweepResult> {
  const now = new Date();
  const config = await getOrCreatePopExportConfig();
  if (!config.enabled && !opts.force) return { skipped: 'disabled', pruned: [] };

  const span = config.frequency === 'BIMONTHLY' ? 2 : 1;
  let earliest: Date | null = null;
  if (!config.exportedThrough) {
    const first = await db.playEvent.findFirst({ orderBy: { startedAt: 'asc' }, select: { startedAt: true } });
    earliest = first?.startedAt ?? null;
  }
  const period = pendingPeriod(config.exportedThrough, earliest, span, now);

  let summary: PopExportSummary | undefined;
  if (period) {
    // Two invocations racing the same period (cron + a manual click): the
    // younger RUNNING row wins, a stale one is a crash and is superseded.
    const running = await db.popExport.findFirst({
      where: { periodStart: period.start, status: 'RUNNING' },
    });
    if (running && now.getTime() - running.startedAt.getTime() < STALE_RUN_MS) {
      return { skipped: 'already-running', pruned: [] };
    }
    if (running) {
      await db.popExport.update({
        where: { id: running.id },
        data: { status: 'FAILED', error: 'superseded — invocation never finished', finishedAt: now },
      });
    }
    summary = await exportPeriod(period, now);
  }

  const pruned = await pruneArchivedPeriods(now);
  return { skipped: period ? undefined : 'up-to-date', export: summary, pruned };
}

async function exportPeriod(period: PopPeriod, now: Date): Promise<PopExportSummary> {
  const record = await db.popExport.create({
    data: { periodLabel: period.label, periodStart: period.start, periodEnd: period.end },
  });

  try {
    if (!isPrivateBucketConfigured()) {
      throw new Error('R2_PRIVATE_BUCKET is not configured — proof-of-play archives are business records and never go to the public bucket.');
    }

    const where = { startedAt: { gte: period.start, lt: period.end } };
    const expected = await db.playEvent.count({ where });
    if (expected > MAX_ROWS_PER_EXPORT) {
      throw new Error(`Period ${period.label} has ${expected.toLocaleString('en-US')} plays — over the ${MAX_ROWS_PER_EXPORT.toLocaleString('en-US')} single-run cap. Switch to monthly frequency or shard this period manually.`);
    }

    // PlayEvent.mediaId / campaignId have no FK relations — resolve names from
    // the (small) Content and Campaign tables up front, one query each.
    const [contents, campaigns] = await Promise.all([
      db.content.findMany({ select: { id: true, name: true } }),
      db.campaign.findMany({ select: { id: true, name: true } }),
    ]);
    const contentName = new Map(contents.map((c) => [c.id, c.name]));
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

    const playLines = [row([
      'playId', 'startedAtIst', 'endedAtIst', 'durationMs', 'screenName', 'groupName', 'deviceId',
      'contentName', 'mediaId', 'campaignName', 'campaignId', 'tag', 'layoutId', 'slotPosition',
      'isFiller', 'impressions', 'costPaise', 'startedAtUtc', 'endedAtUtc', 'createdAtUtc',
      'prevHash', 'rowHash',
    ])];

    type AdAgg = { contentName: string; mediaId: string; campaignName: string; campaignId: string;
      plays: number; ms: number; impressions: number; costPaise: number; screens: Set<string>; first: Date; last: Date };
    type ScreenAgg = { screenName: string; groupName: string; deviceId: string;
      plays: number; ms: number; impressions: number; ads: Set<string>; first: Date; last: Date };
    const byAd = new Map<string, AdAgg>();
    const byScreen = new Map<string, ScreenAgg>();
    const mediaIds = new Set<string>();
    let playCount = 0;
    let cursor: string | null = null;

    // Ascending (startedAt, id) — the same order the tamper-evident prevHash →
    // rowHash chain was written in, so the archive stays verifiable offline.
    // (batch is annotated because `cursor` feeds back into the query — TS7022.)
    type PlayRow = {
      id: string; deviceId: string; campaignId: string | null; mediaId: string; layoutId: string | null;
      startedAt: Date; endedAt: Date; durationMs: number; tag: string | null; slotPosition: number | null;
      isFiller: boolean; impressions: number; costPaise: number; prevHash: string | null; rowHash: string | null;
      createdAt: Date; device: { name: string; groupName: string | null };
    };
    for (;;) {
      const batch: PlayRow[] = await db.playEvent.findMany({
        where,
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        take: READ_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, deviceId: true, campaignId: true, mediaId: true, layoutId: true,
          startedAt: true, endedAt: true, durationMs: true, tag: true, slotPosition: true,
          isFiller: true, impressions: true, costPaise: true, prevHash: true, rowHash: true,
          createdAt: true, device: { select: { name: true, groupName: true } },
        },
      });
      if (!batch.length) break;

      for (const e of batch) {
        playCount++;
        mediaIds.add(e.mediaId);
        const cName = contentName.get(e.mediaId) ?? '';
        const kName = e.campaignId ? campaignName.get(e.campaignId) ?? '' : '';

        playLines.push(row([
          e.id, istStamp(e.startedAt), istStamp(e.endedAt), e.durationMs, e.device.name,
          e.device.groupName, e.deviceId, cName, e.mediaId, kName, e.campaignId, e.tag,
          e.layoutId, e.slotPosition, e.isFiller, e.impressions, e.costPaise,
          e.startedAt.toISOString(), e.endedAt.toISOString(), e.createdAt.toISOString(),
          e.prevHash, e.rowHash,
        ]));

        const adKey = `${e.mediaId}|${e.campaignId ?? ''}`;
        const ad = byAd.get(adKey) ?? {
          contentName: cName, mediaId: e.mediaId, campaignName: kName, campaignId: e.campaignId ?? '',
          plays: 0, ms: 0, impressions: 0, costPaise: 0, screens: new Set<string>(), first: e.startedAt, last: e.startedAt,
        };
        ad.plays++; ad.ms += e.durationMs; ad.impressions += e.impressions; ad.costPaise += e.costPaise;
        ad.screens.add(e.deviceId);
        if (e.startedAt < ad.first) ad.first = e.startedAt;
        if (e.startedAt > ad.last) ad.last = e.startedAt;
        byAd.set(adKey, ad);

        const sc = byScreen.get(e.deviceId) ?? {
          screenName: e.device.name, groupName: e.device.groupName ?? '', deviceId: e.deviceId,
          plays: 0, ms: 0, impressions: 0, ads: new Set<string>(), first: e.startedAt, last: e.startedAt,
        };
        sc.plays++; sc.ms += e.durationMs; sc.impressions += e.impressions; sc.ads.add(e.mediaId);
        if (e.startedAt < sc.first) sc.first = e.startedAt;
        if (e.startedAt > sc.last) sc.last = e.startedAt;
        byScreen.set(e.deviceId, sc);
      }

      cursor = batch[batch.length - 1].id;
      if (batch.length < READ_BATCH) break;
    }

    const byAdLines = [row(['contentName', 'mediaId', 'campaignName', 'campaignId', 'plays', 'totalDurationMs', 'totalImpressions', 'totalCostPaise', 'screens', 'firstPlayIst', 'lastPlayIst'])];
    for (const a of [...byAd.values()].sort((x, y) => y.plays - x.plays)) {
      byAdLines.push(row([a.contentName, a.mediaId, a.campaignName, a.campaignId, a.plays, a.ms, a.impressions, a.costPaise, a.screens.size, istStamp(a.first), istStamp(a.last)]));
    }
    const byScreenLines = [row(['screenName', 'groupName', 'deviceId', 'plays', 'totalDurationMs', 'totalImpressions', 'distinctAds', 'firstPlayIst', 'lastPlayIst'])];
    for (const s of [...byScreen.values()].sort((x, y) => y.plays - x.plays)) {
      byScreenLines.push(row([s.screenName, s.groupName, s.deviceId, s.plays, s.ms, s.impressions, s.ads.size, istStamp(s.first), istStamp(s.last)]));
    }

    // Upload, then re-read each object's size from R2 before anything is
    // recorded as archived — a truncated upload must never advance the
    // watermark (and so must never become prunable).
    const files: [PopExportFile, string][] = [
      ['plays', playLines.join(CRLF) + CRLF],
      ['byAd', byAdLines.join(CRLF) + CRLF],
      ['byScreen', byScreenLines.join(CRLF) + CRLF],
    ];
    let totalBytes = 0;
    for (const [file, csv] of files) {
      const key = exportObjectKey(period.label, file);
      const bytes = Buffer.from(csv, 'utf8');
      await putPrivateObject(key, bytes, 'text/csv; charset=utf-8');
      const head = await headPrivateObject(key);
      if (head?.contentLength !== bytes.byteLength) {
        throw new Error(`Upload verification failed for ${key}: expected ${bytes.byteLength} bytes, R2 reports ${head?.contentLength ?? 'missing'}.`);
      }
      totalBytes += bytes.byteLength;
    }

    if (playCount !== expected) {
      // Rows written during the sweep can only land in the CURRENT month (the
      // player posts as it plays), never inside a completed period — so a
      // mismatch means the sweep itself lost rows. Refuse to advance.
      throw new Error(`Row-count mismatch for ${period.label}: counted ${expected}, exported ${playCount}.`);
    }

    // COMPLETED + watermark move together: a crash between the two would make
    // the next sweep re-export (and harmlessly overwrite) this period.
    const finishedAt = new Date();
    await db.$transaction([
      db.popExport.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED', playCount, adCount: mediaIds.size, screenCount: byScreen.size,
          totalBytes, playsKey: exportObjectKey(period.label, 'plays'),
          byAdKey: exportObjectKey(period.label, 'byAd'), byScreenKey: exportObjectKey(period.label, 'byScreen'),
          finishedAt,
        },
      }),
      db.popExportConfig.update({
        where: { id: 1 },
        data: { exportedThrough: period.end, lastRunAt: now },
      }),
    ]);

    await notifyAdminWA(`ALIVE proof-of-play archive ${period.label}: ${playCount.toLocaleString('en-IN')} plays from ${byScreen.size} screens uploaded to R2 (3 CSVs, ${(totalBytes / 1024).toFixed(0)} KB).`);
    return { id: record.id, periodLabel: period.label, status: 'COMPLETED', playCount, screenCount: byScreen.size, adCount: mediaIds.size, totalBytes, error: null };
  } catch (e) {
    const error = ((e as Error).message || 'unknown error').slice(0, 500);
    await db.popExport.update({
      where: { id: record.id },
      data: { status: 'FAILED', error, finishedAt: new Date() },
    }).catch(() => {});
    await notifyAdminWA(`ALIVE proof-of-play archive ${period.label} FAILED: ${error}`);
    return { id: record.id, periodLabel: period.label, status: 'FAILED', playCount: 0, screenCount: 0, adCount: 0, totalBytes: 0, error };
  }
}

/**
 * Deferred, opt-in pruning of archived periods. Only rows whose period is both
 * behind the watermark AND older than PRUNE_LAG_DAYS are deleted — see the
 * header comment for why the lag is not optional. Runs a few periods per sweep
 * so switching the toggle on after a year of archives drains gradually instead
 * of issuing one giant DELETE.
 */
async function pruneArchivedPeriods(now: Date): Promise<{ periodLabel: string; deletedRows: number }[]> {
  const config = await db.popExportConfig.findUnique({ where: { id: 1 } });
  if (!config?.deleteAfterExport || !config.exportedThrough) return [];

  const lagCutoff = now.getTime() - PRUNE_LAG_DAYS * 86_400_000;
  const cutoff = new Date(Math.min(lagCutoff, config.exportedThrough.getTime()));
  const eligible = await db.popExport.findMany({
    where: { status: 'COMPLETED', deletedRows: null, periodEnd: { lte: cutoff } },
    orderBy: { periodStart: 'asc' },
    take: 6,
  });

  const pruned: { periodLabel: string; deletedRows: number }[] = [];
  for (const p of eligible) {
    const { count } = await db.playEvent.deleteMany({
      where: { startedAt: { gte: p.periodStart, lt: p.periodEnd } },
    });
    await db.popExport.update({ where: { id: p.id }, data: { deletedRows: count } });
    pruned.push({ periodLabel: p.periodLabel, deletedRows: count });
  }
  return pruned;
}
