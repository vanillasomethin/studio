// GET /api/stores/tier-validate?key=...
// Public, display-only. Tells the registration UI which pricing tier a gated
// signup link belongs to, so the form and agreement can show that tier's
// guaranteed monthly minimum.
//
// This never grants anything — /api/stores/save re-resolves the key server-side
// and that is what actually sets Store.slotPricingTier. An unknown or missing
// key resolves to standard, so the plain /store link keeps working.

import { NextRequest, NextResponse } from 'next/server';
import { tierForSignupKey, isConfiguredTierKey } from '@/lib/store-signup-links';
import { TIER_MONTHLY_MINIMUM_RUPEES } from '@shared/agreement-terms';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const tier = tierForSignupKey(key);
  return NextResponse.json({
    tier,
    gated: isConfiguredTierKey(key),
    monthlyMinimumRupees: TIER_MONTHLY_MINIMUM_RUPEES[tier],
  });
}
