// Edge middleware — uses only the lightweight auth config (no Prisma/bcrypt/nodemailer).
// Route protection logic lives in authConfig.callbacks.authorized.

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextRequest, NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

// The `auth()` wrapper is kept for ONE reason: it runs authConfig's `authorized`
// callback, which gates /dashboard (redirect to /login when signed out). It does
// NOT gate the admin API — every admin route now enforces its own auth via
// requireAdmin(), so middleware has no admin job left.
export default auth(function middleware(req: NextRequest) {
  // Strip legacy Clerk handshake params during transition.
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  // The session→shared-password bridge that used to live here is GONE. It injected
  // the ADMIN_PASSWORD header for a session admin so that pre-migration routes
  // (which compared that header) would accept them. All admin routes are on
  // requireAdmin() now, which authorizes a named session DIRECTLY from the cookie,
  // so the bridge became dead weight — and removing it is what actually retires the
  // shared secret: with no code path reading ADMIN_PASSWORD, the env var can be
  // unset and the console is reachable only by a named, revocable, audited login.
  return NextResponse.next();
});

// Runs on only what still needs middleware. The big /api/(admin|...) alternation
// was here solely to feed the credential bridge; with the bridge gone the admin
// API no longer needs an edge pass at all (each route authorizes itself), so the
// matcher shrinks to the two things left: gating /dashboard and the Clerk cleanup.
export const config = {
  matcher: [
    '/dashboard/:path*',
    // Clerk cleanup — remove once all traffic has migrated
    '/(.*)?__clerk_handshake(.*)',
  ],
};
