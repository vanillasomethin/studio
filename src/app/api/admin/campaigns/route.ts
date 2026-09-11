// POST /api/admin/campaigns → { campaign: { id, name, … } }
//
// Creates a bookable campaign directly, without the customer onboarding funnel.
//
// Until now the only way to get a campaign was /brand-onboarding: six steps that
// demand screens, months, a price, an agreement acceptance and a Razorpay order.
// Making an internal booking meant role-playing a customer through checkout, which
// is the single biggest reason putting a brand on a screen took so long.
//
// This used to refuse to create a Brand row, on the grounds that a Brand was a
// CUSTOMER ACCOUNT hanging off a User with a login. Brand.userId is now nullable
// (see the model comment), so a Brand is the ADVERTISER itself and a login is an
// optional attachment — which means an internally-added brand can finally be a
// first-class row rather than free text on Campaign.name.
//
// That matters beyond tidiness: Content.brandId points at Brand, so without a row
// the creative cannot be tagged, the Content tab's brand column stays empty, and
// adding the same advertiser to a second store is as much work as the first.
//
// Pass `brandId` to attach an existing advertiser, or `brandName` to find-or-create
// one by name. Passing neither still works and leaves brandId null — old callers
// and funnel campaigns are unaffected, and every read path keeps its
// `brand?.brandName ?? campaign.name` fallback.
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
      /** Find-or-create the advertiser by name, when the caller has no brand id. */
      brandName?: string;
      slotContentId?: string | null;
      slotPlaylistId?: string | null;
      slotPricingTier?: string;
      pricePerScreen?: number;
      startDate?: string;
      /** Tag the chosen creative as this brand's. Off by default: a shared creative
       *  (a generic offer card, a house asset) must not be claimed by whoever books
       *  it first. The loop panel sets it only for a creative that has no owner yet. */
      tagCreative?: boolean;
    };

    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    // Validate the optional links up front so a bad id is a 400 naming the field
    // rather than an opaque foreign-key 500.
    let brandId: string | null = null;
    if (body.brandId) {
      const brand = await db.brand.findUnique({ where: { id: body.brandId }, select: { id: true } });
      if (!brand) return NextResponse.json({ error: 'Unknown brand' }, { status: 400 });
      brandId = brand.id;
    } else if ((body.brandName ?? '').trim()) {
      // Find-or-create by name, case-insensitively, so the same advertiser typed at
      // two different stores lands on one row instead of splitting in two.
      const wanted = body.brandName!.trim().slice(0, 120);
      const found = await db.brand.findFirst({
        where:  { brandName: { equals: wanted, mode: 'insensitive' } },
        select: { id: true },
      });
      brandId = found
        ? found.id
        : (await db.brand.create({ data: { brandName: wanted }, select: { id: true } })).id;
    }

    let contentOwnerless = false;
    if (body.slotContentId) {
      const content = await db.content.findUnique({
        where: { id: body.slotContentId }, select: { id: true, brandId: true },
      });
      if (!content) return NextResponse.json({ error: 'Unknown creative' }, { status: 400 });
      // Only an UNOWNED creative may be claimed below. Re-tagging one that already
      // belongs to someone would quietly move it between advertisers.
      contentOwnerless = content.brandId == null;
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
        brandId,
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

    // Claim the creative for this advertiser, so the Content tab can group by brand
    // and the next store's picker can default to what this brand already plays.
    // Best-effort on purpose: the campaign is the record that matters, and a
    // Content row racing away underneath must not fail the whole booking.
    let taggedCreative = false;
    if (body.tagCreative && brandId && body.slotContentId && contentOwnerless) {
      taggedCreative = await db.content
        .updateMany({ where: { id: body.slotContentId, brandId: null }, data: { brandId } })
        .then((r) => r.count > 0)
        .catch(() => false);
    }

    // A campaign is what a play is attributed to for proof-of-play and billing, so
    // record who conjured one outside the paid funnel.
    await logAdminAction({
      actor, req,
      action: 'campaign.create',
      target: campaign.id,
      meta:   { name, brandId, pricePerScreen, taggedCreative, viaAdminPanel: true },
    });

    return NextResponse.json({ campaign: { ...campaign, taggedCreative } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
