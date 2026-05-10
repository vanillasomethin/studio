// Edge-safe Auth.js config — no Prisma, bcrypt, or nodemailer imports.
// Used by middleware for lightweight JWT verification.

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages:     { signIn: '/login' },
  trustHost: true,
  session:   { strategy: 'jwt' },
  providers: [], // providers are added in the full auth.ts (Node.js only)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn   = !!auth?.user;
      const pathname   = nextUrl.pathname;
      const isProtected =
        pathname.startsWith('/store-dashboard') ||
        pathname.startsWith('/dashboard');

      if (isProtected) {
        if (loggedIn) return true;
        // Redirect to appropriate login page
        const dest = pathname.startsWith('/store-dashboard')
          ? new URL('/store-dashboard', nextUrl)
          : new URL('/login', nextUrl);
        return Response.redirect(dest);
      }
      return true;
    },
  },
};
