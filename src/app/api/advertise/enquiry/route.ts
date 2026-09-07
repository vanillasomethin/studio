import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { brandEnquiryMsg, notifyAdminEmail, notifyAdminWA } from '@/lib/notify';
import { hitLimit } from '@/lib/rate-limit';
import {
  MAX_MONTHS,
  MAX_SLOTS_PER_STORE,
  MIN_MONTHS,
  MIN_SLOTS_PER_STORE,
  clamp,
  estimate,
  storeById,
} from '@/lib/advertise-network';

/**
 * Advertiser enquiry from /advertise: save the lead, then tell sales.
 *
 * Public and unauthenticated, so three rules shape this route:
 *  - The browser is not trusted for money. The estimate is recomputed here from
 *    the tier rate card, exactly as campaigns/save and verify-payment do; the
 *    totals the page posted are display-only and never written.
 *  - The store list is filtered against the known network before it is stored,
 *    so a hostile body cannot put arbitrary strings in the row.
 *  - The write is the deliverable. A notification that fails is survivable; a
 *    lead that is silently dropped is not.
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
  // estimatedMonthlyRupees / estimatedTotalRupees are also posted. They are
  // deliberately ignored — see the note above.
};

const PHONE = /^[6-9]\d{9}$/;

/** No 0/O/1/I: this gets read down a phone line. 32^8 ≈ 1.1e12 combinations. */
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function newReference(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `ENQ-${out}`;
}

/** Trim, collapse to a sane length, and treat blank as absent. */
function text(v: unknown, max: number): string | null {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s.length > 0 ? s : null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const brandName = text(body.brandName, 200);
  const contactPerson = text(body.contactPerson, 200);
  const phone = (body.phone ?? '').trim();

  // The browser validates the same fields; this is the copy that counts.
  if (!brandName || !contactPerson || !PHONE.test(phone)) {
    return NextResponse.json(
      { error: 'Brand name, contact person and a valid 10-digit mobile number are required.' },
      { status: 400 }
    );
  }

  // Acceptance is the point of the agreement — a submission without it is not a
  // booking enquiry, and a client-side checkbox alone is not a record.
  const agreementVersion = text(body.agreementVersion, 40);
  if (body.agreementAccepted !== true || !agreementVersion) {
    return NextResponse.json(
      { error: 'The advertising terms must be accepted before we can take the enquiry.' },
      { status: 400 }
    );
  }

  // Throttle only well-formed submissions, so someone fixing a typo is never
  // punished while a script still cannot flood the table. hitLimit fails open on
  // a Redis outage by design — for a lead form that is the right trade.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if ((await hitLimit(`advertise:enquiry:ip:${ip}`, 5, 3600)).limited) {
    return NextResponse.json(
      { error: 'That is a lot of enquiries from one place. Please WhatsApp us instead.' },
      { status: 429 }
    );
  }

  // Only stores that exist on the page survive, de-duplicated and capped.
  const storeSlugs = Array.isArray(body.storeIds)
    ? Array.from(
        new Set(
          body.storeIds
            .slice(0, 200)
            .filter((v): v is string => typeof v === 'string' && Boolean(storeById(v)))
        )
      )
    : [];

  const slotsPerStore = clamp(
    Number(body.slotsPerStore) || MIN_SLOTS_PER_STORE,
    MIN_SLOTS_PER_STORE,
    MAX_SLOTS_PER_STORE
  );
  const months = clamp(Number(body.months) || MIN_MONTHS, MIN_MONTHS, MAX_MONTHS);

  // Recomputed here, never taken from the body.
  const totals = estimate(storeSlugs, slotsPerStore, months);

  const acceptedAtRaw = body.agreementAcceptedAt ? new Date(body.agreementAcceptedAt) : null;
  // A clock-skewed or forged timestamp is not evidence of anything, so an
  // unparseable one falls back to server time rather than being stored as-is.
  const agreementAcceptedAt =
    acceptedAtRaw && !Number.isNaN(acceptedAtRaw.getTime()) ? acceptedAtRaw : new Date();

  const whatsappDigits = (body.whatsapp ?? '').trim();
  const data = {
    brandName,
    contactPerson,
    phone,
    whatsapp: PHONE.test(whatsappDigits) ? whatsappDigits : null,
    category: text(body.category, 100),
    budgetBand: text(body.budgetBand, 100),
    storeSlugs,
    slotsPerStore,
    months,
    creativeStatus: text(body.creativeStatus, 40),
    notes: text(body.notes, 2000),
    agreementVersion,
    agreementAcceptedAt,
    estMonthlyPaise: Math.round(totals.monthlyRupees * 100),
    estTotalPaise: Math.round(totals.totalRupees * 100),
  };

  // Retry only the reference collision. Any other failure is real and must
  // surface rather than be swallowed by a loop.
  let reference: string | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3 && !reference; attempt++) {
    const candidate = newReference();
    try {
      const row = await db.brandEnquiry.create({
        data: { ...data, reference: candidate },
        select: { reference: true },
      });
      reference = row.reference;
    } catch (e) {
      lastError = e;
      const code = (e as { code?: string }).code;
      if (code !== 'P2002') break; // not a duplicate reference — stop and report
    }
  }

  const salesMessage = brandEnquiryMsg({
    reference: reference ?? 'NOT SAVED — see below',
    brandName,
    contactPerson,
    phone,
    whatsapp: data.whatsapp,
    category: data.category,
    budgetBand: data.budgetBand,
    storeNames: storeSlugs.map(slug => storeById(slug)?.name ?? slug),
    slotsPerStore,
    months,
    estMonthlyRupees: totals.monthlyRupees,
    estTotalRupees: totals.totalRupees,
    creativeStatus: data.creativeStatus,
    notes: data.notes,
  });

  if (!reference) {
    // The row did not land. Push the lead to sales anyway — a database outage
    // should cost us the record, not the customer — then tell the brand the
    // truth so they can reach us another way.
    await notifyAdminWA(
      `⚠️ Advertiser enquiry FAILED TO SAVE (database error). Details below.\n\n${salesMessage}`
    );
    console.error('[advertise/enquiry] save failed', lastError);
    return NextResponse.json(
      {
        error:
          'We could not record that just now. Please WhatsApp us on +91 96060 72227 and we will pick it up.',
      },
      { status: 500 }
    );
  }

  // Awaited, not fire-and-forget: this function is serverless and may be frozen
  // the moment the response is returned, which would cut an in-flight request.
  // Both helpers swallow their own errors and no-op when unconfigured, so a
  // missing Twilio or Resend key can never fail a saved enquiry.
  await Promise.all([
    notifyAdminWA(salesMessage),
    notifyAdminEmail(
      `New advertiser enquiry ${reference} — ${brandName}`,
      `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${salesMessage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`
    ),
  ]);

  return NextResponse.json({ ok: true, reference });
}
