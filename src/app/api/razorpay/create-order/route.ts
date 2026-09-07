// POST /api/razorpay/create-order
// Creates a Razorpay order for a brand campaign. The charge amount is
// RECOMPUTED server-side from { screens, months, preferredStoreIds,
// couponCode } — the client's own total is never trusted, so it can't be
// tampered with in the browser. Pricing is tier-based: each picked store is
// billed at its slotPricingTier rate resolved from the DB HERE (the client
// sends only ids, never tiers); unpicked screens are Standard.
//
// Body:
//   screens    number   (required)
//   months     number   (required)
//   preferredStoreIds string[]? (map picks — resolved to tiers server-side)
//   couponCode string?  (validated against the DB; ignored if invalid)
//   applyGst   boolean  (whether this flow adds 18% GST — preserves each
//                        flow's existing behaviour; onboarding/renewal = true,
//                        pay-later pending campaign = false)
//   trial      boolean? (free first campaign — server-gated, see below)
//   email      string?  (required when trial=true, for eligibility)
//   receipt    string?
//   notes      object?

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaignTotal, tierCounts, isSlotTier, type SlotTier } from '@/lib/brand-pricing';
import { resolveCoupon } from '@/lib/coupons';
import { sanitizeStoreIds } from '@/lib/store-ids';

export async function POST(req: NextRequest) {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: 'Razorpay credentials are not configured on the server.' },
      { status: 500 },
    );
  }

  try {
    const body = await req.json() as {
      screens?: number; months?: number; couponCode?: string;
      preferredStoreIds?: unknown;
      applyGst?: boolean; trial?: boolean; email?: string;
      receipt?: string; notes?: Record<string, unknown>;
    };

    const screens = Math.floor(Number(body.screens));
    const months  = Math.floor(Number(body.months));
    if (!Number.isFinite(screens) || screens < 1 || screens > 50 || !Number.isFinite(months) || months < 1 || months > 12) {
      return NextResponse.json({ error: 'Invalid order: screens must be 1–50 and months 1–12.' }, { status: 400 });
    }

    // Resolve each picked store's tier from the DB — the client sends ids
    // only, so the rate can't be spoofed. Ids that don't resolve (deleted
    // store, forged id) fall through to Standard inside the pricing helper,
    // matching how ops treats unresolvable picks: routed as plain screens.
    const pickedIds = sanitizeStoreIds(body.preferredStoreIds);
    let tiers: SlotTier[] = [];
    if (pickedIds.length > 0) {
      const stores = await db.store.findMany({
        where:  { id: { in: pickedIds } },
        select: { slotPricingTier: true },
      });
      tiers = stores.map((s) => (isSlotTier(s.slotPricingTier) ? s.slotPricingTier : 'standard'));
    }

    // ── Recompute the authoritative amount (rupees) ────────────────────────────
    let amountRupees: number;
    // The coupon that was actually honoured, as validated here. Stamped into the
    // order notes below so verify-payment can count the redemption against the
    // order rather than against whatever the browser chooses to send back.
    let appliedCoupon: string | null = null;

    if (body.trial) {
      // C1: a free (₹0) campaign is allowed only once per brand — gated by email
      // having no prior campaign. Prevents anyone forcing ₹0 via ?trial=1.
      const email = (body.email ?? '').trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: 'Email is required for a free trial.' }, { status: 400 });
      }
      const priorCampaigns = await db.campaign.count({ where: { email } });
      if (priorCampaigns > 0) {
        return NextResponse.json({ error: 'A free trial has already been used for this account.' }, { status: 403 });
      }
      amountRupees = 0;
    } else {
      // Server-validate the coupon and recompute the discount — the browser's
      // claimed discount is never trusted.
      let discount = 0;
      if (body.couponCode) {
        const base = campaignTotal({ screens, months, tiers, applyGst: false });
        const res  = await resolveCoupon(body.couponCode, base);
        if (res.valid) {
          discount = res.discount;
          appliedCoupon = body.couponCode.toUpperCase();
        }
      }
      amountRupees = campaignTotal({ screens, months, tiers, discount, applyGst: body.applyGst !== false });
    }

    // Razorpay requires note values to be strings
    const safeNotes: Record<string, string> = {};
    if (body.notes && typeof body.notes === 'object') {
      for (const [k, v] of Object.entries(body.notes)) safeNotes[k] = String(v);
    }

    // Bind the ENTITLEMENT to the order, server-side. The amount was already
    // recomputed here from these exact numbers; stamping them into the order's
    // notes means verify-payment can read back what was actually paid for
    // instead of trusting the browser. Written last so a client-supplied note
    // of the same name cannot override it.
    safeNotes.alive_screens = String(screens);
    safeNotes.alive_months  = String(months);
    // The tier mix the amount was computed from (unpicked screens counted as
    // standard). verify-payment compares the saved picks against this, so a
    // buyer can't price standard stores and then claim flagship ones.
    const mix = tierCounts(screens, tiers);
    safeNotes.alive_tiers = `standard:${mix.standard},growth:${mix.growth},flagship:${mix.flagship}`;
    // Same reasoning for the coupon: the discount was granted HERE, so the
    // redemption must be counted against what was granted here. Leaving
    // verify-payment to read the code off the request body let a buyer take the
    // discount and then omit the field, so the usage counter never moved and a
    // capped coupon could be redeemed without limit.
    //
    // Set OR DELETE, never just set. The presence of this note is what
    // verify-payment treats as proof a discount was granted, so a conditional
    // write would let a client pass notes.alive_coupon by hand and burn a
    // redemption off a capped promo it never qualified for.
    if (appliedCoupon) safeNotes.alive_coupon = appliedCoupon;
    else delete safeNotes.alive_coupon;

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(amountRupees * 100), // INR → paise
        currency: 'INR',
        receipt:  body.receipt ?? `alive_${Date.now()}`,
        notes:    safeNotes,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = (data as { error?: { description?: string } }).error?.description
        ?? 'Razorpay order creation failed';
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
