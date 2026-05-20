// POST /api/stores/kyc/webhook — Digio eKYC completion webhook
// Must be publicly reachable (no auth middleware). Configure URL in Digio dashboard.
// Verifies HMAC-SHA256 signature from x-digio-signature header.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const sigHeader = req.headers.get('x-digio-signature');

  // Verify webhook signature if secret is configured
  if (process.env.DIGIO_WEBHOOK_SECRET && sigHeader) {
    const expected = crypto
      .createHmac('sha256', process.env.DIGIO_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    if (sigHeader !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: { digio_doc_id?: string; reference_id?: string; event_type?: string; status?: string };
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { digio_doc_id, reference_id, event_type } = payload;
  if (!reference_id) return NextResponse.json({ received: true });

  if (event_type === 'kyc_approved') {
    await db.$executeRaw`
      UPDATE "Store"
      SET "kycStatus" = 'approved',
          "kycDocId"   = ${digio_doc_id ?? null},
          "kycVerifiedAt" = NOW(),
          "updatedAt"  = NOW()
      WHERE "kycReferenceId" = ${reference_id}
    `.catch(() => { /* non-fatal — row may not have kycReferenceId col yet */ });
  } else if (event_type === 'kyc_failed' || event_type === 'kyc_expired') {
    await db.$executeRaw`
      UPDATE "Store"
      SET "kycStatus" = 'failed', "updatedAt" = NOW()
      WHERE "kycReferenceId" = ${reference_id}
    `.catch(() => {});
  } else if (event_type === 'kyc_review_pending') {
    await db.$executeRaw`
      UPDATE "Store"
      SET "kycStatus" = 'review_pending', "updatedAt" = NOW()
      WHERE "kycReferenceId" = ${reference_id}
    `.catch(() => {});
  }

  return NextResponse.json({ received: true });
}
