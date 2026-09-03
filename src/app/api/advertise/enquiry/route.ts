import { NextRequest, NextResponse } from 'next/server';

/**
 * Advertiser enquiry endpoint for /advertise — PLACEHOLDER.
 *
 * It validates the shape of the submission and hands back a reference so the
 * landing page can show its success state, but it does not persist anything and
 * nobody is notified. Nothing here is a lead until the TODO below is done.
 *
 * TODO: replace this stub with the real endpoint. It needs to:
 *   1. Write the enquiry to Postgres (a BrandEnquiry model, or a Brand row with
 *      status 'enquiry' — decide with whoever owns the brand pipeline). Store
 *      agreementVersion and agreementAcceptedAt alongside it: an accepted
 *      agreement is only evidence if we can reproduce what was accepted.
 *   2. Notify sales — notifyAdminWA() in src/lib/notify.ts.
 *   3. Rate-limit by IP (src/lib/rate-limit.ts): this route is public and
 *      unauthenticated.
 *   4. Return the persisted enquiry id as `reference` instead of the generated
 *      one below.
 */

type Body = {
  brandName?: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  category?: string;
  budgetBand?: string;
  storeIds?: unknown;
  slotsPerStore?: number;
  months?: number;
  creativeStatus?: string;
  notes?: string;
  agreementAccepted?: boolean;
  agreementVersion?: string;
  agreementAcceptedAt?: string;
};

const PHONE = /^[6-9]\d{9}$/;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const brandName = body.brandName?.trim() ?? '';
  const contactPerson = body.contactPerson?.trim() ?? '';
  const phone = body.phone?.trim() ?? '';

  // The browser validates the same fields; this is the copy that counts.
  if (!brandName || !contactPerson || !PHONE.test(phone)) {
    return NextResponse.json(
      { error: 'Brand name, contact person and a valid 10-digit mobile number are required.' },
      { status: 400 }
    );
  }

  // Acceptance is the point of the agreement — a submission without it is not a
  // booking enquiry, and a client-side checkbox alone is not a record.
  if (body.agreementAccepted !== true || !body.agreementVersion) {
    return NextResponse.json(
      { error: 'The advertising terms must be accepted before we can take the enquiry.' },
      { status: 400 }
    );
  }

  // TODO: this reference is generated, not stored — it identifies nothing until
  // the enquiry is actually persisted. Swap it for the row id.
  const reference = `ENQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  return NextResponse.json({ ok: true, reference });
}
