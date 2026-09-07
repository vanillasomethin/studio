// POST /api/razorpay/create-order
// Creates a Razorpay order for a brand campaign. The charge amount is
// RECOMPUTED server-side from { screens, months, couponCode } — the client's
// own total is never trusted, so it can't be tampered with in the browser.
//
// Body:
//   screens    number   (required)
//   months     number   (required)
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
import { asTier, campaignTotal, tierCounts } from '@/lib/brand-pricing';
import { resolveCoupon } from '@/lib/coupons';
import type { SlotTier } from '@/lib/slot-pricing';

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
      applyGst?: boolean; trial?: boolean; email?: string;
      storeIds?: string[];
      receipt?: string; notes?: Record<string, unknown>;
    };

    const months = Math.floor(Number(body.months));
    if (!Number.isFinite(months) || months < 1 || months > 12) {
      return NextResponse.json({ error: 'Invalid order: months must be 1–12.' }, { status: 400 });
    }

    // ── Resolve the picked stores, and price from the DATABASE ────────────────
    //
    // The browser sends ids and nothing else about price. Tiers are re-read here
    // because slotPricingTier is what the charge is computed from — accepting a
    // tier (or a rate, or a total) off the request would let a buyer put a
    // Flagship store in the basket at Standard price. Same rule as the coupon
    // below and as verify-payment: a client-supplied amount is display-only.
    const requestedIds = Array.isArray(body.storeIds)
      ? [...new Set(body.storeIds.filter((s): s is string => typeof s === 'string' && s.length > 0))]
      : [];
    if (requestedIds.length > 50) {
      return NextResponse.json({ error: 'Self-serve bookings are capped at 50 screens.' }, { status: 400 });
    }

    let tiers: SlotTier[] = [];
    if (requestedIds.length > 0) {
      const stores = await db.store.findMany({
        where:  { id: { in: requestedIds } },
        select: { id: true, slotPricingTier: true, onboardingStage: true },
      });
      const usable = stores.filter((s) => s.onboardingStage !== 'rejected');
      if (usable.length !== requestedIds.length) {
        return NextResponse.json(
          { error: 'One or more selected stores are unavailable. Please reselect and try again.' },
          { status: 400 },
        );
      }
      tiers = usable.map((s) => asTier(s.slotPricingTier));
    }

    // With stores picked, the store COUNT is the screen count — the ids win over
    // whatever the browser put in `screens`, so the two can never disagree about
    // what is being bought.
    const screens = requestedIds.length > 0 ? requestedIds.length : Math.floor(Number(body.screens));
    if (!Number.isFinite(screens) || screens < 1 || screens > 50) {
      return NextResponse.json({ error: 'Invalid order: screens must be 1–50 and months 1–12.' }, { status: 400 });
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
        // Must be the tier-aware base, or a PERCENT coupon computes off a
        // subtotal the buyer is not actually being charged.
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
    // The tier mix the amount was computed from (no-pick screens counted as
    // Standard). verify-payment re-vets saved picks against this, so ids can't
    // be swapped for a richer basket after ordering — and when the id notes
    // below don't fit (oversized selection), this binding still travels with
    // the order.
    const mix = tierCounts(screens, tiers);
    safeNotes.alive_tiers = `standard:${mix.standard},growth:${mix.growth},flagship:${mix.flagship}`;
    // The stores that were PRICED. verify-payment records these on the campaign,
    // so what was paid for is what gets booked — not what the browser submits
    // afterwards. Without this a buyer could pay for 20 Standard stores and then
    // post 20 Flagship ids to campaigns/save, taking premium inventory at the
    // Standard price: the charge would be right and the delivery wrong.
    //
    // Razorpay caps a note VALUE at 512 chars and allows 15 keys. A 50-id list of
    // cuids runs ~1,300 chars, so it is split across numbered keys and
    // verify-payment reassembles them in order. Three chunks covers the 50-store
    // ceiling with room to spare; anything beyond it degrades to the count, and
    // the amount stays authoritative regardless.
    for (const k of ['alive_store_ids', 'alive_store_ids2', 'alive_store_ids3']) delete safeNotes[k];
    if (requestedIds.length > 0) {
      const chunks: string[] = [];
      let cur = '';
      for (const id of requestedIds) {
        const next = cur ? `${cur},${id}` : id;
        if (next.length > 512) { chunks.push(cur); cur = id; } else { cur = next; }
      }
      if (cur) chunks.push(cur);
      if (chunks.length <= 3) {
        chunks.forEach((c, i) => { safeNotes[i === 0 ? 'alive_store_ids' : `alive_store_ids${i + 1}`] = c; });
      }
      safeNotes.alive_store_count = String(requestedIds.length);
    } else {
      delete safeNotes.alive_store_count;
    }
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
