// GET /api/stores/verification-photo/view?kind=shop|install[&storeId=...]
//
// The read side of GPS-verified onboarding photos, mirroring the KYC document
// route. The images themselves are unremarkable — a shop front, a mounted TV —
// but each one is paired with the coordinates it was taken at, so a public URL
// is effectively a published map of where our partners live and work, indexable
// and enumerable by anyone. Behind this route, viewing one requires being the
// partner who uploaded it or an admin reviewing onboarding.
//
// Authorised callers: the owning store partner, or an admin.
//
// Legacy photos uploaded before the private bucket are still stored as public
// URLs and are redirected rather than streamed, so onboarding review keeps
// working through the transition. Re-uploading a photo migrates it.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { requireAdmin } from '@/lib/admin-guard';
import { getPrivateObject } from '@/lib/r2';

const KINDS = {
  shop:    'shopPhotoUrl',
  install: 'installPhotoUrl',
} as const;

type Kind = keyof typeof KINDS;

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') as Kind | null;
  if (!kind || !(kind in KINDS)) {
    return NextResponse.json({ error: "kind must be 'shop' or 'install'" }, { status: 400 });
  }

  const requested = req.nextUrl.searchParams.get('storeId');

  // Admins review any store's onboarding evidence; partners see only their own.
  //
  // requireAdmin (the named, 2FA-backed session) rather than the `admin-password`
  // header check, for two reasons. The console renders these photos in a plain
  // <img>, and a browser image request carries cookies but cannot carry a custom
  // header — a header-based check would 401 every thumbnail in the onboarding
  // review, which is the one place these photos exist to be looked at. And the
  // shared secret was deliberately retired from the admin surface; honouring it
  // again here would put every partner's premises behind a credential the rest of
  // the console no longer accepts.
  let storeId: string | null = null;
  if (await requireAdmin(req)) {
    storeId = requested;
  } else {
    storeId = await resolveStoreId(requested);
  }
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Column name comes from the KINDS map above, never from the request.
  const column = KINDS[kind];
  const rows = await db.$queryRawUnsafe<{ v: string | null }[]>(
    `SELECT "${column}" AS v FROM "Store" WHERE "id" = $1 LIMIT 1`,
    storeId,
  ).catch(() => []);

  const stored = rows[0]?.v ?? null;
  if (!stored) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Pre-migration photo — still public, still viewable, not secured by this route.
  if (/^https?:\/\//i.test(stored)) {
    return NextResponse.redirect(stored, 302);
  }

  // The key embeds its owning store, so a tampered row cannot serve another
  // partner's photo through an authorised session.
  if (!stored.startsWith(`verification/${storeId}/`)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const obj = await getPrivateObject(stored);
  if (!obj) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    status: 200,
    headers: {
      'Content-Type':  obj.contentType,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
