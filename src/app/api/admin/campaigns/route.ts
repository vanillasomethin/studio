// POST /api/admin/campaigns → { campaign: { id, name, … } }
//
// Creates a bookable campaign directly, without the customer onboarding funnel.
//
// Until now the only way to get a campaign was /brand-onboarding: six steps that
// demand screens, months, a price, an agreement acceptance and a Razorpay order.
// Making an internal booking meant role-playing a customer through checkout, which
// is the single biggest reason putting a brand on a screen took so long.
//
// Deliberately does NOT create a Brand row. A Brand is a CUSTOMER ACCOUNT — it hangs
// off a User with a login (Brand.userId is required and unique), so minting one for
// an internal booking would fabricate an account nobody can sign into. Campaign.brandId
// is nullable precisely for this case, and every read path already falls back to
// Campaign.name (see slot-occupancy, /api/campaigns/admin). Pass an existing brandId
// to attach a real customer; otherwise the typed name lives on the campaign alone.
//
// Auth: admin session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { istToday } from '@/lib/slots';
import { isSlotTier } from '@/lib/slot-pricing';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as {
      name?: string;
      brandId?: string | null;
      slotContentId?: string | null;
      slotPlaylistId?: string | null;
      slotPricingTier?: string;
      pricePerScreen?: number;
      startDate?: string;
    };

    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    // Validate the optional links up front so a bad id is a 400 naming the field
    // rather than an opaque foreign-key 500.
    if (body.brandId) {
      const brand = await db.brand.findUnique({ where: { id: body.brandId }, select: { id: true } });
      if (!brand) return NextResponse.json({ error: 'Unknown brand' }, { status: 400 });
    }
    if (body.slotContentId) {
      const content = await db.content.findUnique({ where: { id: body.slotContentId }, select: { id: true } });
      if (!content) return NextResponse.json({ error: 'Unknown creative' }, { status: 400 });
    }
    if (body.slotPlaylistId) {
      const pl = await db.playlist.findUnique({ where: { id: body.slotPlaylistId }, select: { id: true } });
      if (!pl) return NextResponse.json({ error: 'Unknown playlist' }, { status: 400 });
    }

    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate ?? '')
      ? new Date(`${body.startDate}T00:00:00Z`)
      : new Date(`${istToday()}T00:00:00Z`);

    // Money is optional and defaults to zero. An admin-created row is a BOOKING
    // record — proof of what is scheduled to play — and pricing it is a separate
    // act ops does in the campaigns tab. Defaulting to a made-up rate would put
    // invented revenue into reports, which is worse than an obvious zero.
    const pricePerScreen = Number.isFinite(body.pricePerScreen) && body.pricePerScreen! >= 0
      ? Math.round(body.pricePerScreen!)
      : 0;

    const campaign = await db.campaign.create({
      data: {
        name,
        brandId:         body.brandId ?? null,
        slotContentId:   body.slotContentId ?? null,
        slotPlaylistId:  body.slotPlaylistId ?? null,
        slotPricingTier: isSlotTier(body.slotPricingTier) ? body.slotPricingTier : 'standard',
        startDate,
        pricePerScreen,
        totalAmount:     pricePerScreen,
        // Bookable immediately — an admin creating this has already decided it runs.
        status: 'active',
      },
      select: { id: true, name: true, brandId: true, slotContentId: true, slotPlaylistId: true, status: true },
    });

    // A campaign is what a play is attributed to for proof-of-play and billing, so
    // record who conjured one outside the paid funnel.
    await logAdminAction({
      actor, req,
      action: 'campaign.create',
      target: campaign.id,
      meta:   { name, brandId: body.brandId ?? null, pricePerScreen, viaAdminPanel: true },
    });

    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
