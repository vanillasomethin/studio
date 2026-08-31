// Edge-safe Auth.js config — no Prisma, bcrypt, or nodemailer imports.
// Used by middleware for lightweight JWT verification.

import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@prisma/client';

export const authConfig: NextAuthConfig = {
  pages:     { signIn: '/login' },
  trustHost: true,
  // 90 days rather than the 30-day default, so an admin types a 2FA code a
  // handful of times a year per browser instead of monthly. Safe to stretch
  // BECAUSE revocation is server-side: requireAdmin checks the AdminSession row
  // on every admin request, so a stolen or stale cookie can be killed instantly
  // from Admin → Team regardless of how long the JWT itself remains signed.
  // (Shared by store partners and brands too — longer sessions are ordinary UX
  // there, and nothing sensitive rides on their cookie lifetime.)
  session:   { strategy: 'jwt', maxAge: 90 * 24 * 60 * 60 },
  providers: [], // providers are added in the full auth.ts (Node.js only)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // /store-dashboard is NOT gated here: unauthenticated visitors previously got
      // redirected to `/store-dashboard` itself -- the same protected path -- which
      // re-triggered this same check and infinite-looped, so nobody could ever reach
      // the sign-in form. The page already renders its own sign-in form client-side
      // when there's no session (store partners aren't required to hold a next-auth
      // session at all -- see CLAUDE.md), so it doesn't need a middleware gate.
      if (pathname.startsWith('/dashboard')) {
        if (loggedIn) return true;
        return Response.redirect(new URL('/login', nextUrl));
      }
      return true;
    },

    // Middleware builds its own NextAuth instance from THIS config, not from
    // auth.ts — and without a session callback here, `req.auth.user` carries
    // only the default name/email/image. `role` would be undefined, so any
    // middleware that gates on ADMIN/OPS would silently never fire: a
    // fail-closed bug, but an invisible one, which is worse than a loud break.
    //
    // The role is already inside the signed JWT (auth.ts's jwt callback puts it
    // there at sign-in). This just copies it onto the session object. Pure
    // field mapping — no Prisma, no bcrypt — so the edge bundle stays light.
    // auth.ts replaces `callbacks` wholesale with its own set, so this does not
    // collide with the session callback defined there.
    async session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id   as string;
        session.user.role = token.role as UserRole;
        // `mfa` must be mapped here too, not only in auth.ts. Middleware reads
        // req.auth from THIS config, so without this line the claim is
        // undefined at the edge and any middleware gating on it cannot see the
        // difference between a second-factor session and a password-only one.
        // That is precisely the check the credential bridge depends on, so an
        // omission here does not fail closed — it hands out the admin secret.
        session.user.mfa  = token.mfa === true;
      }
      return session;
    },
  },
};
