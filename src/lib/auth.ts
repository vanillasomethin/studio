import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Email       from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { verifyTotpStep } from './totp';
import { hitLimit, clearLimit } from './rate-limit';
import type { UserRole } from '@prisma/client';
import { authConfig } from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id:    string;
      role:  UserRole;
      phone: string | null;
      mfa:   boolean;          // set by the jwt/session callbacks below
    };
  }
  interface JWT {
    id?:    string;
    role?:  UserRole;
    phone?: string | null;
    mfa?:   boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),

  providers: [
    // Phone + password — for store partners (and any user with passwordHash)
    Credentials({
      id:   'phone-password',
      name: 'Phone + password',
      credentials: {
        phone:    { label: 'Phone',    type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const raw      = (creds?.phone ?? '').toString();
        const password = (creds?.password ?? '').toString();
        if (!raw || !password) return null;

        // Normalise to E.164 +91XXXXXXXXXX
        const digits = raw.replace(/\D/g, '');
        const phone  = digits.startsWith('91') && digits.length === 12
          ? `+${digits}`
          : `+91${digits.slice(-10)}`;

        const user = await db.user.findUnique({ where: { phone } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),

    // Email + password — for brands, admin, ops
    Credentials({
      id:   'email-password',
      name: 'Email + password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email    = (creds?.email    ?? '').toString().trim().toLowerCase();
        const password = (creds?.password ?? '').toString();
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),

    // Admin/ops login — email + password + TOTP second factor.
    //
    // Deliberately a SEPARATE provider from 'email-password' rather than an
    // extension of it: brands and store partners authenticate through that one,
    // and adding a second-factor branch to a shared code path risks locking out
    // users who have nothing to do with the admin console. Admin login is also
    // the one path where a hard MFA requirement is worth the friction.
    Credentials({
      id:   'admin-mfa',
      name: 'Admin (email + password + 2FA)',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
        totp:     { label: '2FA code', type: 'text'     },
      },
      async authorize(creds) {
        const email    = (creds?.email    ?? '').toString().trim().toLowerCase();
        const password = (creds?.password ?? '').toString();
        const totp     = (creds?.totp     ?? '').toString();
        if (!email || !password) return null;

        // Throttle per account before any credential work. Six-digit codes are
        // brute-forceable in minutes otherwise, and bcrypt comparison is
        // deliberately slow, so refusing early also blunts CPU exhaustion.
        // Keyed by email, not IP: rotating source addresses is cheap, and the
        // thing actually under attack is one account.
        const limitKey = `admin:login:${email}`;
        const limit = await hitLimit(limitKey, 8, 900); // 8 per 15 min
        if (limit.limited) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        // Only ADMIN/OPS may authenticate through this provider. Without this, a
        // store partner's credentials would mint a session that the admin guard
        // then has to re-check — better to refuse the wrong door outright.
        if (user.role !== 'ADMIN' && user.role !== 'OPS') return null;

        if (!(await bcrypt.compare(password, user.passwordHash))) return null;

        // Password alone is never sufficient for an enrolled account. Checked
        // AFTER the password so a valid code can't confirm an email's existence.
        if (user.mfaEnabledAt) {
          if (!user.mfaSecret) return null;               // enrolled but no seed — fail closed
          const step = verifyTotpStep(user.mfaSecret, totp);
          if (step === null) return null;

          // Single use. A code stays valid ~90s across the ±1 drift window, so
          // one observed by a phishing proxy or over a shoulder is otherwise
          // replayable for the rest of its life. Claimed with a conditional
          // UPDATE rather than read-then-write, so two sign-ins racing on the
          // same code cannot both win: the loser matches zero rows.
          const claimed = await db.user.updateMany({
            where: { id: user.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
            data:  { mfaLastStep: step },
          });
          if (claimed.count === 0) return null;
        }

        // Full success — release the throttle so ordinary daily logins by a
        // legitimate operator can never accumulate into a lockout.
        await clearLimit(limitKey);
        // Not yet enrolled: allowed through so the account can reach the
        // enrolment screen at all — bootstrapping the first admin is otherwise
        // impossible. The console forces enrolment before anything else, and
        // `mfaEnabledAt` being null is what it keys off.

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),

    // Email magic-link — for brands and admin/ops (no password)
    ...(process.env.EMAIL_SERVER_HOST
      ? [Email({
          server: {
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
            auth: {
              user: process.env.EMAIL_SERVER_USER,
              pass: process.env.EMAIL_SERVER_PASSWORD,
            },
          },
          from: process.env.EMAIL_FROM ?? 'hello@wearealive.in',
        })]
      : []),
  ],

  callbacks: {
    authorized: authConfig.callbacks!.authorized,

    // Defense-in-depth choke point: ADMIN/OPS may authenticate ONLY through the
    // MFA-enforcing 'admin-mfa' provider. Holds across every provider and survives
    // adding new ones, so a stolen admin password can never mint an admin session
    // via email-password / phone-password / magic-link. Non-privileged users
    // (store partners, brands) are unaffected.
    async signIn({ user, account }) {
      if (!user?.id) return true;                 // e.g. Email provider's send-phase stub
      const dbUser = await db.user.findUnique({
        where:  { id: user.id },
        select: { role: true },
      });
      if ((dbUser?.role === 'ADMIN' || dbUser?.role === 'OPS')
          && account?.provider !== 'admin-mfa') {
        return false;                             // wrong door for a privileged account
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        const dbUser = await db.user.findUnique({ where: { id: user.id! } });
        if (dbUser) {
          token.id    = dbUser.id;
          token.role  = dbUser.role;
          token.phone = dbUser.phone;
          // Positive MFA assertion: true only for a completed admin-mfa login by
          // an ENROLLED account. A bootstrapping admin (admin-mfa but mfaEnabledAt
          // null) stays false and may reach only /api/admin/mfa (see requireAdmin).
          token.mfa   = account?.provider === 'admin-mfa' && !!dbUser.mfaEnabledAt;
        }
      }
      return token;   // account is undefined on refreshes, so token.mfa persists
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id as string;
        session.user.role  = token.role as UserRole;
        session.user.phone = (token.phone as string | null) ?? null;
        session.user.mfa   = (token.mfa as boolean) ?? false;
      }
      return session;
    },
  },
});
