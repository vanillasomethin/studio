// GET /api/stores/kyc/doc?slot=pan|aadhaar|selfie[&storeId=...]
//
// The only path by which a KYC document can be read. The bytes live in the
// private R2 bucket, which has no public domain, so there is no URL to leak,
// guess, forward or index — a reader must present credentials to this route on
// every single view.
//
// Two callers are authorised, and only these:
//   • the store partner who owns the document (resolveStoreId)
//   • an admin reviewing the submission (admin-password)
//
// Responses are marked no-store so an identity document is never written to a
// browser or CDN cache.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { requireAdmin } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { getPrivateObject } from '@/lib/r2';

const SLOTS = {
  pan:     'kycPanUrl',
  aadhaar: 'kycAadhaarUrl',
  selfie:  'kycSelfieUrl',
} as const;

type Slot = keyof typeof SLOTS;

export async function GET(req: NextRequest) {
  const slot = req.nextUrl.searchParams.get('slot') as Slot | null;
  if (!slot || !(slot in SLOTS)) {
    return NextResponse.json({ error: 'slot must be pan, aadhaar or selfie' }, { status: 400 });
  }

  const requestedStoreId = req.nextUrl.searchParams.get('storeId');

  // Admins may read any store's documents for review; partners only their own.
  // resolveStoreId is checked first so a partner request never depends on the
  // admin path, and an admin request never needs a partner token.
  // requireAdmin rather than the header-only isAdmin(): identical for the shared
  // password, but it also accepts a named session AND checks that session is still
  // live — so revoking someone in Admin → Team stops them reading identity
  // documents on their very next request, instead of whenever their JWT expires.
  let storeId: string | null = null;
  const actor = await requireAdmin(req);
  if (actor) {
    storeId = requestedStoreId;
  } else {
    storeId = await resolveStoreId(requestedStoreId);
  }
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // A deliberate exception to "log mutations, not reads": for an identity
  // document, the READ is the sensitive event. Aadhaar and PAN are exactly what a
  // misused admin account would be after, and "who viewed this partner's Aadhaar,
  // and when" is a question we should be able to answer. Only admin views are
  // recorded — a partner opening their own document is not noteworthy, and logging
  // it would bury the views that are.
  if (actor) {
    await logAdminAction({
      actor, req,
      action: 'store.view_kyc_doc',
      target: storeId,
      // 'slot' names which document (pan|aadhaar|selfie) — not the document itself.
      meta:   { slot },
    });
  }

  const column = SLOTS[slot];
  const rows = await db.$queryRawUnsafe<{ v: string | null }[]>(
    `SELECT "${column}" AS v FROM "Store" WHERE "id" = $1 LIMIT 1`,
    storeId,
  ).catch(() => []);
  // `column` is looked up from the SLOTS map above, never taken from the
  // request, so it cannot carry injected SQL.

  const stored = rows[0]?.v ?? null;
  if (!stored) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Documents uploaded before the private bucket existed were stored as public
  // URLs. Redirect those so review keeps working, but they are NOT secured by
  // this route — re-upload is what moves a partner onto the private bucket.
  if (/^https?:\/\//i.test(stored)) {
    return NextResponse.redirect(stored, 302);
  }

  // Defence in depth: the key embeds its owning store, so even a corrupted or
  // tampered database value cannot make this route serve another store's file.
  if (!stored.startsWith(`kyc/${storeId}/`)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const obj = await getPrivateObject(stored);
  if (!obj) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    status: 200,
    headers: {
      'Content-Type':  obj.contentType,
      'Cache-Control': 'no-store, private',
      // Never let an identity document render inline in a hostile context.
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
