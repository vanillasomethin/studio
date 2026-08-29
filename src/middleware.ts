// Edge middleware — uses only the lightweight auth config (no Prisma/bcrypt/nodemailer).
// Route protection logic lives in authConfig.callbacks.authorized.

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextRequest, NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

// Admin API surface reachable from the console. Listed explicitly rather than
// matching /api/:path* so the two highest-volume paths — `/api/device/*` (player
// heartbeats, plan polls, proof-of-play) and `/api/cron/*` — never pay for a JWT
// decode they have no use for. Note `/api/device/` (singular, the player API) is
// deliberately absent while `/api/devices/` (plural, fleet admin) is present.
const ADMIN_API = [
  'admin', 'schedules', 'playlists', 'content', 'devices', 'slots',
  'compositions', 'overlays', 'campaigns', 'coupons', 'products', 'events',
  'reports', 'flyers', 'footfall', 'health', 'presence', 'query', 'context',
  'site-media', 'telemetry', 'stores', 'brands', 'payout', 'bills', 'feed',
];

export default auth(function middleware(req: NextRequest & { auth?: { user?: { role?: string; mfa?: boolean } } | null }) {
  // Strip legacy Clerk handshake params during transition
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  // ─── Transitional bridge: named admin session → legacy credential header ───
  //
  // 72 admin routes still authenticate by comparing an `admin-password` header,
  // and know nothing about sessions. Without this, an operator who signs in with
  // email + password + 2FA would be met with 401 from almost the entire console
  // — which would make enabling MFA a downgrade, and nobody would adopt it.
  //
  // So for a request already proven to carry an ADMIN/OPS session that CLEARED
  // ITS SECOND FACTOR, middleware supplies the credential those routes expect.
  //
  //   • The role and the mfa claim come from the signed JWT, so forging either
  //     needs AUTH_SECRET — at which point any session could be minted anyway.
  //   • A client may still send its own `admin-password`, exactly as before. If
  //     it is wrong the legacy guard rejects it; being wrong here changes nothing.
  //   • If ADMIN_PASSWORD is unset, nothing is injected and the legacy guards
  //     stay fail-closed — a session admin simply gets 401, never a bypass.
  //
  // The `mfa === true` test is load-bearing, and role alone is NOT sufficient.
  // The sign-in path deliberately lets an un-enrolled admin through so the first
  // one can bootstrap (auth.ts skips the TOTP branch when mfaEnabledAt is null),
  // and every account is un-enrolled on the day this ships. Gating on role alone
  // would therefore hand the real ADMIN_PASSWORD — and with it ~74 legacy routes
  // including KYC identity documents, payout data and fleet commands — to anyone
  // holding just an admin email and password. That is strictly worse than before
  // this bridge existed, when an account password bought no API access at all.
  // Requiring the claim also excludes JWTs minted before this deploy, which
  // carry no mfa claim and cannot be retro-verified.
  //
  // The secret never reaches the browser: it is read server-side and attached to
  // the *inbound* request as it continues to the route handler.
  //
  // This is scaffolding with a purpose, not a permanent design. Every route
  // migrated to requireAdmin() stops needing it, and when the last one lands
  // this block and ADMIN_PASSWORD both go away. Until then it is what makes 2FA
  // adoptable without a 72-file big-bang change.
  const role = req.auth?.user?.role;
  const mfaCleared = req.auth?.user?.mfa === true;
  const secret = process.env.ADMIN_PASSWORD;
  if (secret && mfaCleared && (role === 'ADMIN' || role === 'OPS')) {
    const headers = new Headers(req.headers);
    headers.set('admin-password', secret);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
});

// Only run middleware on the routes that actually need it.
// Keeping the matcher tight reduces edge invocations and bundle pressure.
export const config = {
  matcher: [
    '/dashboard/:path*',
    `/api/:path(${ADMIN_API.join('|')})/:rest*`,
    // Clerk cleanup — remove once all traffic has migrated
    '/(.*)?__clerk_handshake(.*)',
  ],
};
