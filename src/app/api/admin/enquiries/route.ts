// GET /api/admin/enquiries — advertiser enquiries from /advertise (admin)
// Auth: requireAdmin — admin/ops session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { storeById } from '@/lib/advertise-network';

/**
 * Store names are resolved here rather than in the browser: the slugs are page
 * config (src/lib/advertise-network.ts), and a panel that imported that config
 * would drift the moment the network list changes on only one side.
 *
 * Capped rather than paginated. Enquiries arrive at human speed, so a few
 * hundred is years of them, and the panel filters client-side over one payload
 * instead of round-tripping every keystroke. Revisit if this ever truncates.
 */
const MAX_ROWS = 500;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const rows = await db.brandEnquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  const enquiries = rows.map(row => ({
    ...row,
    // A slug with no match is shown as itself rather than dropped — a store
    // renamed out of the config should not silently vanish from an old lead.
    storeNames: row.storeSlugs.map(slug => storeById(slug)?.name ?? slug),
  }));

  return NextResponse.json({ enquiries, truncated: rows.length === MAX_ROWS });
}
