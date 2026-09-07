// CSV export of hourly footfall data for a store.
// GET /api/footfall/:storeId/export/csv?from=&to=
// Auth: admin — named session, or the legacy admin-password as header or query param.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

// This route is opened as a plain <a href> download (see getFootfallExportUrl in
// src/lib/backend-api.ts), and a bare browser navigation cannot carry a custom
// header — which is why the password has always been accepted as a query param
// here too. The guard reads exactly one header, so it is handed a view of the
// request where `admin-password` falls back to the query string. Nothing else
// is widened: every other header, and the session path, are untouched. A named
// admin session needs none of this, since cookies do ride along on navigation.
function withQueryPassword(req: NextRequest) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'admin-password'
          ? req.headers.get(name) ?? req.nextUrl.searchParams.get('admin-password')
          : req.headers.get(name),
    },
  };
}

function esc(v: string | number | null | undefined) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  if (!(await requireAdmin(withQueryPassword(req)))) return adminUnauthorized();
  const { storeId } = await params;

  const { searchParams } = new URL(req.url);
  const to   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date();
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  const hourly = await db.footfallHourly.findMany({
    where: { storeId, hourBucket: { gte: from, lte: to } },
    orderBy: { hourBucket: 'asc' },
  });

  const header = ['hour_utc', 'customer_count', 'unconfirmed_count', 'avg_confidence', 'excluded_count'];
  const rows = hourly.map((h) => [
    esc(h.hourBucket.toISOString()),
    esc(h.customerCount),
    esc(h.unconfirmedCount),
    esc(h.avgConfidence?.toFixed(3) ?? ''),
    esc(h.excludedCount),
  ].join(','));

  const csv = [header.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="footfall-${storeId}.csv"`,
    },
  });
}
