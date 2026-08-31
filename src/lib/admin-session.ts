// Admin console session tokens.
//
// Edge-safe on purpose: middleware verifies these on every admin request, so
// this module must not import Prisma, bcrypt, or anything Node-only. The token
// is self-contained — identity travels in the payload, so verification needs no
// database round-trip.
//
// Flow:
//   POST /api/admin/auth  → verifies email + password (Node route, bcrypt)
//                         → sets ADMIN_COOKIE to a token signed here
//   middleware            → verifies the cookie, injects the shared
//                           admin-password secret + x-admin-* identity headers
//                           downstream, so existing routes are unchanged
//
// The shared secret therefore never reaches a browser.

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

export const ADMIN_COOKIE = 'alive_admin_session';
export const SESSION_HOURS = 12;

/** Identity headers middleware puts on the forwarded request. */
export const ADMIN_ID_HEADER    = 'x-admin-id';
export const ADMIN_NAME_HEADER  = 'x-admin-name';
export const ADMIN_EMAIL_HEADER = 'x-admin-email';
export const ADMIN_TEAM_HEADER  = 'x-admin-team';

export type AdminIdentity = {
  id:    string;
  name:  string;
  email: string;
  team:  string;
};

/**
 * The server-side secrets an admin session needs end to end, and which of them
 * are missing here.
 *
 * Two different secrets have to be present for a sign-in to be worth anything:
 * AUTH_SECRET signs the session cookie, and ADMIN_PASSWORD is what middleware
 * hands downstream for the route guards to check. With either one absent a
 * sign-in can still *look* successful while every subsequent admin request
 * answers `{"error":"Unauthorized"}` — the console renders, and nothing in it
 * loads. Sign-in checks this first and refuses with the names of the missing
 * variables instead.
 */
export function missingAdminSecrets(): string[] {
  const missing: string[] = [];
  if (!process.env.AUTH_SECRET)    missing.push('AUTH_SECRET');
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  return missing;
}

function secretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

export async function signAdminSession(admin: AdminIdentity): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error('AUTH_SECRET is not set — cannot issue admin sessions.');
  return new SignJWT({ name: admin.name, email: admin.email, team: admin.team })
    .setProtectedHeader({ alg: ALG })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key);
}

export async function verifyAdminSession(token: string | undefined | null): Promise<AdminIdentity | null> {
  if (!token) return null;
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    if (!payload.sub) return null;
    return {
      id:    payload.sub,
      name:  String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      team:  String(payload.team ?? ''),
    };
  } catch {
    return null;
  }
}
