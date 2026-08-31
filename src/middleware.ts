// Edge middleware — uses only the lightweight auth config (no Prisma/bcrypt/nodemailer).
// Route protection logic lives in authConfig.callbacks.authorized.

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE, verifyAdminSession,
  ADMIN_ID_HEADER, ADMIN_NAME_HEADER, ADMIN_EMAIL_HEADER, ADMIN_TEAM_HEADER,
} from '@/lib/admin-session';

const { auth } = NextAuth(authConfig);

/**
 * Admin console requests carry a per-person session cookie, not the shared
 * secret. Verify it here and hand the downstream route the shared
 * admin-password value it already checks, plus who the person is — that way
 * every existing admin route keeps working unchanged while the browser never
 * sees ADMIN_PASSWORD.
 *
 * The x-admin-* headers are stripped from every inbound request first. They are
 * the audit trail's idea of who did something, and a client that could set them
 * itself could sign someone else's name to its actions — so downstream they only
 * ever mean "middleware verified this session cookie".
 *
 * Requests without a valid session still reach the route, which falls back to
 * its own admin-password check: nothing is newly opened up here.
 */
const IDENTITY_HEADERS = [ADMIN_ID_HEADER, ADMIN_NAME_HEADER, ADMIN_EMAIL_HEADER, ADMIN_TEAM_HEADER];

async function withAdminIdentity(req: NextRequest): Promise<NextResponse | null> {
  const forged = IDENTITY_HEADERS.some((h) => req.headers.has(h));
  const token  = req.cookies.get(ADMIN_COOKIE)?.value;
  const admin  = token ? await verifyAdminSession(token) : null;
  if (!admin && !forged) return null;

  const headers = new Headers(req.headers);
  for (const h of IDENTITY_HEADERS) headers.delete(h);

  if (admin) {
    const shared = process.env.ADMIN_PASSWORD;
    if (shared) headers.set('admin-password', shared);
    headers.set(ADMIN_ID_HEADER, admin.id);
    headers.set(ADMIN_NAME_HEADER, admin.name);
    headers.set(ADMIN_EMAIL_HEADER, admin.email);
    headers.set(ADMIN_TEAM_HEADER, admin.team);
  }

  return NextResponse.next({ request: { headers } });
}

export default auth(async function middleware(req: NextRequest) {
  // Strip legacy Clerk handshake params during transition
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    const injected = await withAdminIdentity(req);
    if (injected) return injected;
  }

  return NextResponse.next();
});

// Only run middleware on the routes that actually need it.
// Keeping the matcher tight reduces edge invocations and bundle pressure.
export const config = {
  matcher: [
    '/dashboard/:path*',
    // Admin console APIs — the session cookie is exchanged for the shared
    // secret + identity headers here (see withAdminIdentity). Device endpoints
    // are excluded: they authenticate by device JWT and are the hot path.
    '/api/((?!device/).*)',
    // Clerk cleanup — remove once all traffic has migrated
    '/(.*)?__clerk_handshake(.*)',
  ],
};
