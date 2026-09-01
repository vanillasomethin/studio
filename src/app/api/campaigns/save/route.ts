// POST /api/campaigns/save — books a campaign from the brand-onboarding funnel.
//
// DELIBERATELY PUBLIC, and it has to stay that way: this is the last step of
// self-serve onboarding for brands who do not have an account yet. Requiring a
// session here would close the funnel, so the defences below all assume the
// caller is anonymous and hostile, and constrain what an anonymous caller can
// cause rather than trying to identify them.
//
// What an anonymous caller still CANNOT do:
//   • mint a paid-looking campaign — `status` is whitelisted, and only
//     verify-payment (after a Razorpay signature check) may set 'active'
//   • choose their own price — a ₹0 booking is normalised to a trial
//   • attach a booking to somebody else's Brand account — brandId is linked only
//     when a signed-in session proves the email belongs to the caller (below)
//   • flood the table — per-IP and per-email limits
//
// Residual risk, deliberately NOT fixed here because it needs a product
// decision: a free trial is gated per email address, and nothing proves the
// submitter owns that address. Anyone can therefore burn a competitor's one free
// trial by posting a ₹0 booking with their email, after which the real brand
// gets "A free trial has already been used for this account." permanently. The
// real fix is to verify the address before a trial is granted (emailed link /
// OTP). Until then, every trial claim raises an admin notification so a disputed
// one can be spotted and cleared rather than silently blocking a customer.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { respond } from '@/lib/api-envelope';
import { hitLimit } from '@/lib/rate-limit';
import { notifyAdminWA } from '@/lib/notify';

// Free-text fields are written straight to rows that ops reads. Caps stop an
// anonymous caller using the table as free storage, and keep a hostile string
// from crowding out the surrounding context in an admin list. Rejected rather
// than truncated: silently storing a shortened GSTIN would be worse than saying no.
const MAX_LEN: Record<string, number> = {
  brandName: 120, contactName: 120, email: 254, phone: 20, gstin: 15,
};

export async function POST(req: NextRequest) {
  const route = '/api/campaigns/save';
  const startedAtMs = Date.now();
  try {
    const body = await req.json() as {
      brandName:      string;
      contactName:    string;
      email:          string;
      phone:          string;
      gstin?:         string;
      screens:        number;
      months:         number;
      startDate:      string;
      pricePerScreen: number;
      totalAmount:    number;
      paymentId?:     string;
      orderId?:       string;
      status?:        string;
      preferredStoreIds?: unknown; // store ids picked on the onboarding map
    };

    if (!body.email || !body.brandName) {
      const envelope = await respond({ error: 'brandName and email required' }, { route, request: { hasEmail: !!body.email, hasBrandName: !!body.brandName }, outcome: 'invalid_request', policyFlags: ['missing_required_fields'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
    }

    // Length caps before anything touches the database.
    const fields = body as unknown as Record<string, unknown>;
    const tooLong = Object.entries(MAX_LEN).find(([field, max]) => {
      const value = fields[field];
      return typeof value === 'string' && value.length > max;
    });
    if (tooLong) {
      const envelope = await respond({ error: `${tooLong[0]} is too long (max ${tooLong[1]} characters).` }, { route, request: { field: tooLong[0] }, outcome: 'invalid_request', policyFlags: ['field_too_long'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
    }

    // Throttle before the DB work. Two keys, because they bound different abuses:
    // the IP limit caps bulk submission from one source, the email limit stops a
    // single address being hammered. Generous enough that a real brand retrying a
    // failed payment never trips it, and shared office NAT is not punished.
    //
    // hitLimit fails OPEN by design (a Redis outage must not close the funnel), so
    // `degraded` is surfaced in telemetry — a silent loss of throttling would be
    // worse than a noisy one.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'unknown';
    const ipLimit = await hitLimit(`campaign:save:ip:${ip}`, 20, 3600);
    if (ipLimit.limited) {
      // 'conflict' rather than 'invalid_request': the request is well-formed, it
      // is the rate that is refused. policyFlags carries the real reason.
      const envelope = await respond({ error: 'Too many booking attempts. Please try again shortly.' }, { route, request: { ip }, outcome: 'conflict', policyFlags: ['rate_limited_ip'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 429 });
    }

    // This route is unauthenticated — never let the client mint an 'active'
    // (i.e. paid-looking) campaign. Paid status is set only by verify-payment
    // after the Razorpay signature check.
    if (body.status && !['upcoming', 'pending_payment', 'trial'].includes(body.status)) {
      const envelope = await respond({ error: 'Invalid campaign status.' }, { route, request: { status: body.status }, outcome: 'invalid_request', policyFlags: ['invalid_status'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
    }

    const screens = Math.floor(Number(body.screens ?? 1));
    const months  = Math.floor(Number(body.months  ?? 1));
    if (!Number.isFinite(screens) || screens < 1 || screens > 50 || !Number.isFinite(months) || months < 1 || months > 12) {
      const envelope = await respond({ error: 'Invalid booking: screens must be 1–50 and months 1–12.' }, { route, request: { screens: body.screens, months: body.months }, outcome: 'invalid_request', policyFlags: ['invalid_bounds'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();

    const emailLimit = await hitLimit(`campaign:save:email:${email}`, 5, 3600);
    if (emailLimit.limited) {
      const envelope = await respond({ error: 'Too many booking attempts for this email. Please try again shortly.' }, { route, request: { email }, outcome: 'conflict', policyFlags: ['rate_limited_email'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 429 });
    }

    // Map-picked store ids — a routing hint for ops, not a reservation. Sanitised
    // hard because the route is unauthenticated: strings only, cuid-shaped, capped
    // at the screen ceiling. Unknown ids are tolerated (ops sees names resolved
    // from the DB; anything unresolvable simply doesn't render).
    // Truncate BEFORE per-element work so an oversized hostile array costs nothing.
    const preferredStoreIds = Array.isArray(body.preferredStoreIds)
      ? body.preferredStoreIds
          .slice(0, 200)
          .filter((v): v is string => typeof v === 'string' && /^[a-z0-9]{20,32}$/.test(v))
          .slice(0, 50)
      : [];

    // A ₹0 booking IS a trial regardless of what the client claims, and a
    // claimed trial is always ₹0 — normalising here keeps the two in lockstep
    // so reporting can filter on status alone.
    const isTrial = Number(body.totalAmount) <= 0 || body.status === 'trial';
    const status  = isTrial ? 'trial' : (body.status ?? 'upcoming');

    // C1: a free trial is allowed only once per brand. Without this, anyone
    // could repeatedly create ₹0 campaigns via the ?trial=1 link. The
    // totalAmount leg covers legacy trial rows saved as pending_payment ₹0.
    if (isTrial) {
      // Case-insensitive: the lookup normalised the address but earlier rows
      // were stored as typed, so a lowercase-only match let the same brand take
      // a fresh trial just by capitalising a letter. New rows are written
      // normalised (below); this also catches the ones that already exist.
      const priorFreeTrials = await db.campaign.count({
        where: {
          email: { equals: email, mode: 'insensitive' },
          OR: [{ status: 'trial' }, { totalAmount: { lte: 0 } }],
        },
      });
      if (priorFreeTrials > 0) {
        const envelope = await respond({ error: 'A free trial has already been used for this account.' }, { route, request: { email }, outcome: 'invalid_request', policyFlags: ['trial_already_used'], errorCategory: 'validation', startedAtMs });
        return NextResponse.json(envelope, { status: 403 });
      }
    }

    // Link to a Brand account ONLY when the caller has proven the address is
    // theirs. This previously linked on an email match alone, so an anonymous
    // caller could post a booking with a real brand's address and have the forged
    // campaign appear attached to that brand's account.
    //
    // Being strict costs nothing here: the brand-facing views look campaigns up by
    // EMAIL, not brandId (see /api/brand/slot-stats), so a signed-out booking is
    // still visible to the brand once they sign in. brandId is an ops convenience,
    // and ops can attach a genuine one by hand.
    //
    // auth() is imported lazily so the Prisma adapter and bcrypt aren't pulled
    // into this public route for the common signed-out case, and a throw outside
    // a session context means "no session" — never "link it anyway".
    let brandId: string | null = null;
    try {
      const { auth } = await import('@/lib/auth');
      const session = await auth();
      const sessionEmail = session?.user?.email?.trim().toLowerCase();
      if (sessionEmail && sessionEmail === email) {
        const brand = await db.brand.findFirst({
          where:  { email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        });
        brandId = brand?.id ?? null;
      }
    } catch {
      // No session — leave unlinked. Never a reason to fail a legitimate booking.
    }

    const campaign = await db.campaign.create({
      data: {
        brandId,
        name:           `${body.brandName} — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
        contactName:    body.contactName,
        // Store the normalised address — writing it as typed while looking it up
        // lowercased is what let the trial gate be bypassed by capitalisation.
        email,
        phone:          body.phone ?? undefined,
        screens,
        months,
        startDate:      new Date(body.startDate),
        pricePerScreen: body.pricePerScreen,
        totalAmount:    isTrial ? 0 : body.totalAmount,
        paymentId:      body.paymentId  ?? null,
        orderId:        body.orderId    ?? null,
        status,
        preferredStoreIds,
      },
    });

    // A trial claim consumes that email's one free trial PERMANENTLY, and nothing
    // here proves the submitter owns the address. Until trials are gated on a
    // verified address, this notification is what makes a burned trial visible:
    // a brand phoning up to say "it says I already used my trial" can be matched
    // against a claim nobody recognises, and the row cleared. Fire-and-forget —
    // an alerting outage must never fail a real booking.
    if (isTrial) {
      void notifyAdminWA(
        `Free trial claimed\nBrand: ${body.brandName}\nEmail: ${email}\n` +
        `Screens: ${screens} · Months: ${months}\n` +
        `Signed in: ${brandId ? 'yes' : 'no'} · IP: ${ip}\n` +
        `If this brand did not book it, delete the campaign to release their trial.`,
      );
    }

    const envelope = await respond({ success: true, id: campaign.id }, { route, request: { email: body.email, brandName: body.brandName, rateLimitDegraded: ipLimit.degraded || emailLimit.degraded }, outcome: 'success', startedAtMs });
    return NextResponse.json(envelope);
  } catch (e) {
    const envelope = await respond({ error: (e as Error).message ?? 'Failed to save campaign' }, { route, request: { operation: 'create_campaign' }, outcome: 'server_error', policyFlags: ['exception'], errorCategory: 'runtime', startedAtMs });
    return NextResponse.json(envelope, { status: 500 });
  }
}
