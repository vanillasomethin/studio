// POST /api/stores/kyc — initiate a Digio Aadhaar eKYC session for the authenticated store partner
// Returns: { kycId, customerIdentifier, tokenId } or { status, verifiedAt } if already approved

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

function digioBase() {
  return process.env.DIGIO_BASE_URL ?? 'https://ext.digio.in';
}

function digioAuthHeader() {
  const id  = process.env.DIGIO_CLIENT_ID  ?? '';
  const sec = process.env.DIGIO_CLIENT_SECRET ?? '';
  return `Basic ${Buffer.from(`${id}:${sec}`).toString('base64')}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await db.$queryRaw<{ kycStatus: string | null; kycVerifiedAt: Date | null }[]>`
    SELECT "kycStatus", "kycVerifiedAt" FROM "Store" WHERE "userId" = ${session.user.id} LIMIT 1
  `.catch(() => []);

  return NextResponse.json({
    status:      (row[0]?.kycStatus ?? 'not_started'),
    verifiedAt:  row[0]?.kycVerifiedAt instanceof Date ? row[0].kycVerifiedAt.toISOString() : null,
    configured:  !!(process.env.DIGIO_CLIENT_ID && process.env.DIGIO_TEMPLATE_NAME),
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.DIGIO_CLIENT_ID || !process.env.DIGIO_CLIENT_SECRET || !process.env.DIGIO_TEMPLATE_NAME) {
    return NextResponse.json({ error: 'Digio eKYC is not configured on this server.' }, { status: 503 });
  }

  // Fetch store + user details
  const rows = await db.$queryRaw<{
    id: string; ownerName: string; whatsapp: string; kycStatus: string | null;
    email: string | null;
  }[]>`
    SELECT s."id", s."ownerName", s."whatsapp",
           (SELECT "kycStatus" FROM "Store" WHERE "id" = s."id" LIMIT 1) AS "kycStatus",
           u."email"
    FROM "Store" s
    LEFT JOIN "User" u ON u."id" = s."userId"
    WHERE s."userId" = ${session.user.id}
    LIMIT 1
  `.catch(() => []);

  if (!rows.length) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const store = rows[0];

  if (store.kycStatus === 'approved') {
    return NextResponse.json({ error: 'KYC is already verified.' }, { status: 409 });
  }

  const referenceId = `kyc_${store.id}_${Date.now()}`;
  // Prefer email, fall back to phone number (Digio accepts both)
  const customerIdentifier = store.email ?? `91${store.whatsapp.replace(/\D/g, '').slice(-10)}`;
  const customerName       = store.ownerName;

  const digioRes = await fetch(`${digioBase()}/v2/client/kyc/request`, {
    method:  'POST',
    headers: { Authorization: digioAuthHeader(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      customer_identifier:  customerIdentifier,
      customer_name:        customerName,
      reference_id:         referenceId,
      template_name:        process.env.DIGIO_TEMPLATE_NAME,
      notify_customer:      false,
      generate_access_token: true,
    }),
  });

  if (!digioRes.ok) {
    const err = await digioRes.json().catch(() => ({})) as { message?: string };
    return NextResponse.json({ error: err.message ?? 'Digio API error' }, { status: 502 });
  }

  const data = await digioRes.json() as {
    id: string;
    access_token?: { id: string };
  };

  // Persist referenceId on Store (best-effort)
  await db.$executeRaw`
    UPDATE "Store"
    SET "kycStatus" = 'pending', "kycReferenceId" = ${referenceId}, "updatedAt" = NOW()
    WHERE "userId" = ${session.user.id}
  `.catch(() => { /* non-fatal */ });

  return NextResponse.json({
    kycId:               data.id,
    customerIdentifier,
    tokenId:             data.access_token?.id ?? null,
    env:                 process.env.DIGIO_ENV ?? 'sandbox',
  });
}
