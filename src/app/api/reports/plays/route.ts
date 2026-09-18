// Proof-of-Play reporting query — powers the admin "Proof of Play" tab.
// GET /api/reports/plays?from=&to=&deviceId=&mediaId=&groupNames=a,b&limit=&cursor=&format=json|csv
// Auth: admin-password header
//
// Every filter is optional and composable, so the same endpoint serves:
//   • By Screen  → ?deviceId=…            (list every play on one TV)
//   • By Ad      → ?mediaId=…             (which screens played one video)
//   • By Groups  → ?groupNames=A,B        (plays across all screens in those groups)
// all scoped by a from/to datetime range applied to PlayEvent.startedAt.
//
// Returns a page of individual plays (newest first) PLUS summary rollups computed
// server-side over the FULL matching set via a single groupBy, so the KPI/rollup
// numbers stay accurate even though the row list is paginated.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

const ROW_CAP = 2000; // hard cap on rows returned per page (summary is unaffected)
const SESSION_CAP = 20_000; // hard cap on on-air stretches returned (format=sessions); the fold itself is uncapped

function csvEsc(v: string | number | null | undefined) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const p          = req.nextUrl.searchParams;
  const deviceId   = p.get('deviceId') ?? undefined;
  const mediaId    = p.get('mediaId')  ?? undefined;
  const groupNames = (p.get('groupNames') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const from       = p.get('from') ? new Date(p.get('from')!) : undefined;
  const to         = p.get('to')   ? new Date(p.get('to')!)   : undefined;
  const format     = p.get('format') ?? 'json';
  const limit      = Math.min(Number(p.get('limit') ?? 1000), ROW_CAP);
  const cursor     = p.get('cursor') ?? undefined;

  try {
    // Resolve group names → device ids (grouping lives only on Device.groupName).
    // If groups are selected but resolve to no devices, there's nothing to report.
    let deviceScope: Prisma.PlayEventWhereInput = {};
    let scopeIds: string[] | null = null;   // resolved device ids, for the raw sessions query
    if (groupNames.length) {
      const inGroup = await db.device.findMany({
        where:  { groupName: { in: groupNames }, ...(deviceId ? { id: deviceId } : {}) },
        select: { id: true },
      });
      const ids = inGroup.map((d) => d.id);
      if (!ids.length) return emptyResponse(format);
      deviceScope = { deviceId: { in: ids } };
      scopeIds    = ids;
    } else if (deviceId) {
      deviceScope = { deviceId };
      scopeIds    = [deviceId];
    }

    const where: Prisma.PlayEventWhereInput = {
      ...deviceScope,
      ...(mediaId ? { mediaId } : {}),
      ...(from || to ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };

    // ── CSV export: full matching set, one row per play, with resolved names ──
    if (format === 'csv') {
      const all = await db.playEvent.findMany({
        where,
        select: {
          id: true, deviceId: true, mediaId: true, startedAt: true, endedAt: true, durationMs: true,
          device: { select: { name: true, groupName: true } },
        },
        orderBy: { startedAt: 'asc' },
        take: 100_000,
      });
      const nameMap = await contentNameMap(all.map((e) => e.mediaId));
      const header = 'startedAt,endedAt,durationMs,screenName,groupName,contentName,mediaId,deviceId,id';
      const lines = all.map((e) => [
        csvEsc(e.startedAt.toISOString()), csvEsc(e.endedAt.toISOString()), csvEsc(e.durationMs),
        csvEsc(e.device.name), csvEsc(e.device.groupName), csvEsc(nameMap.get(e.mediaId) ?? ''),
        csvEsc(e.mediaId), csvEsc(e.deviceId), csvEsc(e.id),
      ].join(','));
      const csv = [header, ...lines].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type':        'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="alive-proof-of-play-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // ── Sessions: the play log folded into "screen was on" stretches ──
    // A screen doesn't report on/off — it reports plays. Consecutive plays with no
    // meaningful gap between them mean it was running the whole time, so merging them
    // gives an on-air timeline. A gap longer than gapMs is the screen being off (power
    // cut, unplugged, closed for the night).
    //
    // Folded in SQL, per device, because the volume makes any row-fetching approach
    // wrong rather than merely slow: slots are SLOT_DURATION_MS (10s) long, so one
    // screen running 12h emits ~4,300 PlayEvents a day and a 7-screen group clears
    // 200k inside the tab's default 7-day range. Reading rows into the function to
    // fold them in JS would need a cap, and a capped fold draws a screen that was on
    // as a screen that was dark. Postgres does the gaps-and-islands in place against
    // @@index([deviceId, startedAt]) and hands back one row per on-air stretch.
    //
    // PER DEVICE, never across devices: screens in a group interleave their plays, so
    // one global fold would report the group as continuously on whenever any single
    // screen was — the exact question the timeline exists to answer.
    if (format === 'sessions') {
      const gapMs = Math.max(60_000, Math.min(Number(p.get('gapMs') ?? 600_000), 6 * 3_600_000));

      // The fold is uncapped by design, so it must never be unbounded: without a lower
      // bound a caller that omits from/to (the date picker hands back a cleared range on
      // an ordinary "re-pick the start" click) would fold the entire table. 90 days is
      // the longest range the tab itself offers.
      const foldFrom = from ?? new Date(Date.now() - 90 * 86_400_000);

      const conds: Prisma.Sql[] = [Prisma.sql`"startedAt" >= ${foldFrom}`];
      if (scopeIds) conds.push(Prisma.sql`"deviceId" IN (${Prisma.join(scopeIds)})`);
      if (mediaId)  conds.push(Prisma.sql`"mediaId" = ${mediaId}`);
      if (to)       conds.push(Prisma.sql`"startedAt" <= ${to}`);
      const whereSql = Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`;

      // prev_end is the running max of every earlier end in the partition, not the
      // previous row's end: a long play can finish after the next one starts, and
      // LAG would then split a session that never actually stopped.
      const rows = await db.$queryRaw<{ deviceId: string; start: Date; end: Date; plays: number }[]>(Prisma.sql`
        WITH ev AS (
          SELECT "deviceId", "startedAt", GREATEST("endedAt", "startedAt") AS ended
          FROM "PlayEvent"
          ${whereSql}
        ),
        marked AS (
          SELECT "deviceId", "startedAt", ended,
                 MAX(ended) OVER (PARTITION BY "deviceId" ORDER BY "startedAt"
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_end
          FROM ev
        ),
        islands AS (
          SELECT "deviceId", "startedAt", ended,
                 SUM(CASE WHEN prev_end IS NULL
                           OR "startedAt" > prev_end + (${gapMs} * interval '1 millisecond')
                          THEN 1 ELSE 0 END)
                   OVER (PARTITION BY "deviceId" ORDER BY "startedAt" ROWS UNBOUNDED PRECEDING) AS island
          FROM marked
        )
        SELECT "deviceId",
               MIN("startedAt")  AS start,
               MAX(ended)        AS end,
               COUNT(*)::int     AS plays
        FROM islands
        GROUP BY "deviceId", island
        ORDER BY "deviceId", start
        LIMIT ${SESSION_CAP + 1}
      `);

      const truncated = rows.length > SESSION_CAP;
      const kept      = truncated ? rows.slice(0, SESSION_CAP) : rows;

      const byDevice = new Map<string, { start: string; end: string; plays: number }[]>();
      for (const r of kept) {
        const list = byDevice.get(r.deviceId) ?? [];
        list.push({ start: r.start.toISOString(), end: r.end.toISOString(), plays: r.plays });
        byDevice.set(r.deviceId, list);
      }

      const devMap = await db.device.findMany({
        where:  { id: { in: [...byDevice.keys()] } },
        select: { id: true, name: true, groupName: true },
      }).then((ds) => new Map(ds.map((d) => [d.id, d])));

      const screens = [...byDevice.entries()].map(([id, sessions]) => ({
        deviceId:   id,
        screenName: devMap.get(id)?.name ?? id,
        groupName:  devMap.get(id)?.groupName ?? null,
        sessions,
        totalMs: sessions.reduce((n, x) => n + (Date.parse(x.end) - Date.parse(x.start)), 0),
        plays:   sessions.reduce((n, x) => n + x.plays, 0),
      })).sort((a, b) => a.screenName.localeCompare(b.screenName));

      // truncated can only fire on an implausible number of distinct on-air stretches,
      // but a short timeline must never be drawn as fact — the client says so.
      return NextResponse.json({
        gapMs, screens, sessionCount: kept.length, truncated,
      });
    }

    // ── JSON: paginated rows + full-set summary rollups ──
    const [matchedCount, rows, grouped] = await Promise.all([
      db.playEvent.count({ where }),
      db.playEvent.findMany({
        where,
        select: {
          id: true, deviceId: true, mediaId: true, startedAt: true, endedAt: true, durationMs: true,
          device: { select: { name: true, groupName: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      // One groupBy over (mediaId, deviceId) folds into every rollup we need.
      db.playEvent.groupBy({
        by: ['mediaId', 'deviceId'],
        where,
        _count: { _all: true },
        _sum:   { durationMs: true },
        _max:   { startedAt: true },
      }),
    ]);

    const hasMore    = rows.length > limit;
    const page       = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    // Resolve human names for every device + content appearing in the rollups.
    const deviceIds = [...new Set(grouped.map((g) => g.deviceId))];
    const mediaIds  = [...new Set(grouped.map((g) => g.mediaId))];
    const [devMap, contentMap] = await Promise.all([
      db.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true, groupName: true } })
        .then((ds) => new Map(ds.map((d) => [d.id, d]))),
      db.content.findMany({ where: { id: { in: mediaIds } }, select: { id: true, name: true, type: true } })
        .then((cs) => new Map(cs.map((c) => [c.id, c]))),
    ]);

    // Fold the (media,device) groups into by-screen / by-content / by-group rollups.
    const byScreenMap  = new Map<string, { deviceId: string; screenName: string; groupName: string | null; plays: number; totalMs: number; lastPlayedAt: string }>();
    const byContentMap = new Map<string, { mediaId: string; contentName: string; contentType: string | null; plays: number; totalMs: number; screens: number; lastPlayedAt: string }>();
    const byGroupMap   = new Map<string, { groupName: string; plays: number; totalMs: number; screenSet: Set<string> }>();
    let totalPlays = 0, totalMs = 0;

    for (const g of grouped) {
      const plays = g._count._all;
      const ms    = g._sum.durationMs ?? 0;
      const last  = g._max.startedAt ? g._max.startedAt.toISOString() : '';
      totalPlays += plays; totalMs += ms;

      const dev   = devMap.get(g.deviceId);
      const grp   = dev?.groupName ?? null;

      const sRow = byScreenMap.get(g.deviceId) ?? { deviceId: g.deviceId, screenName: dev?.name ?? g.deviceId, groupName: grp, plays: 0, totalMs: 0, lastPlayedAt: '' };
      sRow.plays += plays; sRow.totalMs += ms; if (last > sRow.lastPlayedAt) sRow.lastPlayedAt = last;
      byScreenMap.set(g.deviceId, sRow);

      const cnt = contentMap.get(g.mediaId);
      const cRow = byContentMap.get(g.mediaId) ?? { mediaId: g.mediaId, contentName: cnt?.name ?? g.mediaId, contentType: cnt ? cnt.type.toLowerCase() : null, plays: 0, totalMs: 0, screens: 0, lastPlayedAt: '' };
      cRow.plays += plays; cRow.totalMs += ms; cRow.screens += 1; if (last > cRow.lastPlayedAt) cRow.lastPlayedAt = last;
      byContentMap.set(g.mediaId, cRow);

      const gkey = grp ?? 'Ungrouped';
      const gRow = byGroupMap.get(gkey) ?? { groupName: gkey, plays: 0, totalMs: 0, screenSet: new Set<string>() };
      gRow.plays += plays; gRow.totalMs += ms; gRow.screenSet.add(g.deviceId);
      byGroupMap.set(gkey, gRow);
    }

    const byScreen  = [...byScreenMap.values()].sort((a, b) => b.plays - a.plays);
    const byContent = [...byContentMap.values()].sort((a, b) => b.plays - a.plays);
    const byGroup   = [...byGroupMap.values()].map((g) => ({ groupName: g.groupName, plays: g.plays, totalMs: g.totalMs, screens: g.screenSet.size })).sort((a, b) => b.plays - a.plays);

    const enrichedRows = page.map((e) => ({
      id:          e.id,
      deviceId:    e.deviceId,
      screenName:  e.device.name,
      groupName:   e.device.groupName,
      mediaId:     e.mediaId,
      contentName: contentMap.get(e.mediaId)?.name ?? null,
      contentType: contentMap.get(e.mediaId)?.type?.toLowerCase() ?? null,
      startedAt:   e.startedAt.toISOString(),
      endedAt:     e.endedAt.toISOString(),
      durationMs:  e.durationMs,
    }));

    return NextResponse.json({
      matchedCount,
      rowsTruncated: matchedCount > enrichedRows.length,
      rows: enrichedRows,
      nextCursor,
      summary: {
        totalPlays,
        totalMs,
        screens:      byScreen.length,
        contentCount: byContent.length,
        byScreen,
        byContent,
        byGroup,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Batch-load Content.name for a set of mediaIds (PlayEvent.mediaId has no FK to Content). */
async function contentNameMap(mediaIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds)];
  if (!ids.length) return new Map();
  const rows = await db.content.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function emptyResponse(format: string) {
  if (format === 'csv') {
    return new NextResponse('startedAt,endedAt,durationMs,screenName,groupName,contentName,mediaId,deviceId,id\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="alive-proof-of-play.csv"' },
    });
  }
  if (format === 'sessions') return NextResponse.json({ gapMs: 600_000, screens: [], sessionCount: 0, truncated: false });
  return NextResponse.json({
    matchedCount: 0, rowsTruncated: false, rows: [], nextCursor: null,
    summary: { totalPlays: 0, totalMs: 0, screens: 0, contentCount: 0, byScreen: [], byContent: [], byGroup: [] },
  });
}
