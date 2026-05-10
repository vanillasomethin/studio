import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Email       from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db } from './db';
import type { UserRole } from '@prisma/client';
import { authConfig } from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id:    string;
      role:  UserRole;
      phone: string | null;
    };
  }
  interface JWT {
    id?:    string;
    role?:  UserRole;
    phone?: string | null;
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
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await db.user.findUnique({ where: { id: user.id! } });
        if (dbUser) {
          token.id    = dbUser.id;
          token.role  = dbUser.role;
          token.phone = dbUser.phone;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id as string;
        session.user.role  = token.role as UserRole;
        session.user.phone = (token.phone as string | null) ?? null;
      }
      return session;
    },
  },
});
