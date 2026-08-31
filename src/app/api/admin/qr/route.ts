// GET /api/admin/qr?days=30 — QR destinations with scan totals and a daily series.
//
// Totals come from a groupBy over QrScan; the daily breakdown is bucketed by IST
// calendar day, because "how many scans yesterday" means yesterday in Mangaluru,
// not UTC. Prisma can't group by a date expression, so the window's rows are
// grouped in JS — at QR-scan volumes that is far cheaper than a raw query, and
// the window is bounded.

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const MAX_DAYS = 365;

/** IST calendar date (YYYY-MM-DD) for an instant. */
const istDay = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export type QrDestinationStats = {
  id: string;
  slug: string;
  targetUrl: string;
  label: string | null;
  createdAt: string;
  totalScans: number;      // all time
  windowScans: number;     // within the requested window
  lastScanAt: string | null;
  daily: { date: string; scans: number }[];
};

export type QrResponse = {
  days: number;
  dates: string[];         // oldest → newest, gaps filled with zeroes
  totals: { destinations: number; scans: number; windowScans: number };
  destinations: QrDestinationStats[];
};

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(MAX_DAYS, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 30)));

  // Window start = midnight IST, `days - 1` days back (so days=1 means today).
  const todayIst = istDay(new Date());
  const since = new Date(new Date(`${todayIst}T00:00:00.000+05:30`).getTime() - (days - 1) * DAY_MS);

  const [destinations, allTime, windowRows] = await Promise.all([
    db.qrDestination.findMany({ orderBy: { createdAt: 'asc' } }),
    db.qrScan.groupBy({
      by: ['destinationId'],
      _count: { _all: true },
      _max: { scannedAt: true },
    }),
    db.qrScan.findMany({
      where: { scannedAt: { gte: since } },
      select: { destinationId: true, scannedAt: true },
      orderBy: { scannedAt: 'asc' },
    }),
  ]);

  const allTimeById = new Map(allTime.map((r) => [r.destinationId, r]));

  // destinationId → IST day → count
  const byDay = new Map<string, Map<string, number>>();
  for (const row of windowRows) {
    const day = istDay(row.scannedAt);
    const forDest = byDay.get(row.destinationId) ?? new Map<string, number>();
    forDest.set(day, (forDest.get(day) ?? 0) + 1);
    byDay.set(row.destinationId, forDest);
  }

  // Every day in the window, so a chart shows the zeroes rather than skipping them.
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(istDay(new Date(new Date(`${todayIst}T00:00:00.000+05:30`).getTime() - i * DAY_MS)));
  }

  const stats: QrDestinationStats[] = destinations.map((d) => {
    const agg     = allTimeById.get(d.id);
    const forDest = byDay.get(d.id) ?? new Map<string, number>();
    const daily   = dates.map((date) => ({ date, scans: forDest.get(date) ?? 0 }));
    return {
      id:         d.id,
      slug:       d.slug,
      targetUrl:  d.targetUrl,
      label:      d.label,
      createdAt:  d.createdAt.toISOString(),
      totalScans: agg?._count._all ?? 0,
      windowScans: daily.reduce((n, x) => n + x.scans, 0),
      lastScanAt: agg?._max.scannedAt?.toISOString() ?? null,
      daily,
    };
  });

  const body: QrResponse = {
    days,
    dates,
    totals: {
      destinations: destinations.length,
      scans:        stats.reduce((n, d) => n + d.totalScans, 0),
      windowScans:  stats.reduce((n, d) => n + d.windowScans, 0),
    },
    destinations: stats,
  };

  return NextResponse.json(body);
}
