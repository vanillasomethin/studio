// Manual KYC for store partners.
// GET   — current status + doc URLs
// POST  — submit uploaded doc URLs + Aadhaar last 4 digits for admin review

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';

export async function GET(req: NextRequest) {
  const storeId = await resolveStoreId(req.nextUrl.searchParams.get('storeId'));
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.$queryRaw<{
    kycStatus: string | null; kycPanUrl: string | null; kycAadhaarUrl: string | null;
    kycSelfieUrl: string | null; kycAadhaarLast4: string | null;
    kycSubmittedAt: Date | null; kycVerifiedAt: Date | null; kycRejectedReason: string | null;
  }[]>`
    SELECT "kycStatus", "kycPanUrl", "kycAadhaarUrl", "kycSelfieUrl",
           "kycAadhaarLast4", "kycSubmittedAt", "kycVerifiedAt", "kycRejectedReason"
    FROM "Store" WHERE "id" = ${storeId} LIMIT 1
  `.catch(() => []);

  const r = rows[0];
  // Return a route to fetch each document through, never the underlying key or
  // URL: the object itself must stay unaddressable, and every view has to pass
  // the auth check in /api/stores/kyc/doc.
  const docUrl = (slot: 'pan' | 'aadhaar' | 'selfie', stored: string | null | undefined) =>
    stored ? `/api/stores/kyc/doc?slot=${slot}&storeId=${encodeURIComponent(storeId)}` : null;

  return NextResponse.json({
    status:          r?.kycStatus ?? 'not_started',
    panUrl:          docUrl('pan',     r?.kycPanUrl),
    aadhaarUrl:      docUrl('aadhaar', r?.kycAadhaarUrl),
    selfieUrl:       docUrl('selfie',  r?.kycSelfieUrl),
    aadhaarLast4:    r?.kycAadhaarLast4 ?? null,
    submittedAt:     r?.kycSubmittedAt instanceof Date ? r.kycSubmittedAt.toISOString() : null,
    verifiedAt:      r?.kycVerifiedAt  instanceof Date ? r.kycVerifiedAt.toISOString()  : null,
    rejectedReason:  r?.kycRejectedReason ?? null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    storeId?: string;
    panUrl?: string; aadhaarUrl?: string; selfieUrl?: string; aadhaarLast4?: string;
  };

  const storeId = await resolveStoreId(body.storeId);
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Each supplied value is stored and later read back by the document route, so
  // it must be a key this store actually owns — not an arbitrary caller-supplied
  // string. Without this a partner could point their KYC record at another
  // store's object, or at an off-site URL the admin console would then load
  // while reviewing them.
  const ownsKey = (v: string) => v.startsWith(`kyc/${storeId}/`) && !v.includes('..');
  for (const [label, value] of [
    ['PAN', body.panUrl], ['Aadhaar', body.aadhaarUrl], ['selfie', body.selfieUrl],
  ] as const) {
    if (value && !ownsKey(value)) {
      return NextResponse.json(
        { error: `Invalid ${label} document reference. Please re-upload the document.` },
        { status: 400 },
      );
    }
  }

  // Merge rather than replace: a partner correcting one rejected document should
  // not have to re-upload the two that were already accepted.
  const current = await db.$queryRaw<{
    kycPanUrl: string | null; kycAadhaarUrl: string | null; kycSelfieUrl: string | null;
  }[]>`
    SELECT "kycPanUrl", "kycAadhaarUrl", "kycSelfieUrl" FROM "Store" WHERE "id" = ${storeId} LIMIT 1
  `.catch(() => []);

  const panUrl     = body.panUrl     || current[0]?.kycPanUrl     || null;
  const aadhaarUrl = body.aadhaarUrl || current[0]?.kycAadhaarUrl || null;
  const selfieUrl  = body.selfieUrl  || current[0]?.kycSelfieUrl  || null;

  if (!panUrl || !aadhaarUrl || !selfieUrl) {
    return NextResponse.json({ error: 'PAN, Aadhaar and selfie are all required.' }, { status: 400 });
  }
  if (body.aadhaarLast4 && !/^\d{4}$/.test(body.aadhaarLast4)) {
    return NextResponse.json({ error: 'Aadhaar last 4 must be 4 digits.' }, { status: 400 });
  }

  await db.$executeRaw`
    UPDATE "Store"
    SET "kycStatus"        = 'submitted',
        "kycPanUrl"        = ${panUrl},
        "kycAadhaarUrl"    = ${aadhaarUrl},
        "kycSelfieUrl"     = ${selfieUrl},
        "kycAadhaarLast4"  = ${body.aadhaarLast4 ?? null},
        "kycSubmittedAt"   = NOW(),
        "kycRejectedReason" = NULL,
        "updatedAt"        = NOW()
    WHERE "id" = ${storeId}
  `;

  return NextResponse.json({ ok: true });
}
