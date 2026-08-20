// GET /api/admin/signup-links — the gated per-tier store signup links.
//
// Admin-only: these URLs embed the secret that decides a store's pricing tier,
// so they must never reach a public surface. Only tiers whose key env var is
// actually set are returned; the rest report configured:false so the admin can
// see what still needs an env var.

import { NextRequest, NextResponse } from 'next/server';
import { SLOT_TIERS } from '@/lib/slot-pricing';
import { TIER_KEY_ENV, TIER_LABEL } from '@/lib/store-signup-links';
import { TIER_MONTHLY_MINIMUM_RUPEES } from '@shared/agreement-terms';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = req.nextUrl.origin;
  const links = SLOT_TIERS.map((tier) => {
    const key = process.env[TIER_KEY_ENV[tier]];
    return {
      tier,
      label: TIER_LABEL[tier],
      envVar: TIER_KEY_ENV[tier],
      monthlyMinimumRupees: TIER_MONTHLY_MINIMUM_RUPEES[tier],
      configured: !!key,
      url: key ? `${origin}/store?tier=${encodeURIComponent(key)}` : null,
    };
  });

  return NextResponse.json({ links });
}
