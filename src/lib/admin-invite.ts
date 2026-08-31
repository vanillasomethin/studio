// Single-use invitations for admin/ops accounts.
//
// The flow deliberately never produces a password that anyone but the invitee
// knows. An admin creates the account with NO passwordHash; the invitee follows
// an emailed link and sets their own. Nothing credential-shaped travels through
// WhatsApp, and the person who created the account cannot log in as them.
//
// The raw token exists in exactly two places: the email, and the URL in the
// invitee's browser. Only its SHA-256 lands in the database, so a dump of
// AdminInvite yields no usable links — the same reasoning that makes us store
// password hashes rather than passwords.

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { revokeAllForUser } from './admin-session';
import type { UserRole } from '@prisma/client';

/// 48 hours: long enough to survive a weekend, short enough that a link found
/// in an old inbox months later is inert.
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

/// Matches scripts/create-admin.mjs. An admin password guards the whole fleet,
/// so it is held to more than the 6 chars store partners get.
export const MIN_PASSWORD_LENGTH = 12;

/// bcrypt cost. 12 is ~4x the work of the 10 used for store partners — worth it
/// on the handful of accounts that can control every screen.
const BCRYPT_COST = 12;

export type InviteRole = Extract<UserRole, 'ADMIN' | 'OPS'>;

/// Console accounts must live on the company domain. Personal addresses are the
/// usual way admin access outlives employment: a gmail.com account keeps working
/// after someone leaves, and nobody can disable it from the ALIVE side.
export const ADMIN_EMAIL_DOMAIN = 'wearealive.in';

/**
 * Is this address allowed to hold a console account?
 *
 * Parsed rather than suffix-matched. `endsWith('@wearealive.in')` looks correct
 * but accepts `attacker@evil.com@wearealive.in` — a string with two @ signs that
 * some mail parsers read as the FIRST address. Splitting and requiring exactly
 * two parts removes that whole class of trick, and an exact domain comparison
 * (not endsWith) additionally rejects `x@notwearealive.in`.
 */
export function isAllowedAdminEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain === ADMIN_EMAIL_DOMAIN;
}

/** SHA-256 hex of a token. The only form we persist. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create (or refresh) an invite for an email address.
 *
 * The User row is created up front with `passwordHash: null` so the person shows
 * up in the team list as "invited — not yet set up" rather than appearing out of
 * nowhere once they accept.
 *
 * Returns the RAW token — the only time it exists. Callers must email it and
 * must not log or store it.
 */
export async function createInvite(
  email: string,
  role: InviteRole,
  invitedBy: string | null,
): Promise<{ token: string; expiresAt: Date; isExistingUser: boolean }> {
  const normalised = email.trim().toLowerCase();

  // Enforced HERE as well as in the route. A route check protects the console;
  // this protects every caller, including scripts and anything added later —
  // and creating the User row is the irreversible step worth guarding.
  if (!isAllowedAdminEmail(normalised)) {
    throw new Error(`Console accounts must be @${ADMIN_EMAIL_DOMAIN} addresses.`);
  }

  const existing = await db.user.findUnique({
    where:  { email: normalised },
    select: { id: true, passwordHash: true },
  });

  // Create the account shell now, or promote an existing user to the admin role.
  // Deliberately does NOT touch passwordHash, mfaSecret or mfaEnabledAt on an
  // existing user: re-inviting someone must never silently wipe the credentials
  // they already have — that only happens if they actually accept.
  await db.user.upsert({
    where:  { email: normalised },
    update: { role },
    create: { email: normalised, role, name: normalised.split('@')[0] },
  });

  const token     = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Supersede any outstanding invite for this address. Two live links to the
  // same account is one more than necessary, and the older one is usually the
  // one that leaked (forwarded mail, shared screen).
  await db.adminInvite.updateMany({
    where: { email: normalised, acceptedAt: null },
    data:  { expiresAt: new Date(0) },
  });

  await db.adminInvite.create({
    data: { email: normalised, role, tokenHash: hashToken(token), invitedBy, expiresAt },
  });

  return { token, expiresAt, isExistingUser: !!existing?.passwordHash };
}

export type InviteCheck =
  | { ok: true;  email: string; role: InviteRole }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Validate a token without consuming it — used to render the setup page.
 *
 * The three failure reasons are reported separately here because this is not an
 * authentication oracle: you must already hold a 256-bit token to learn
 * anything, and telling someone "this link has expired" instead of a blank
 * "invalid" is the difference between them asking for a new one and giving up.
 */
export async function checkInvite(token: string): Promise<InviteCheck> {
  if (!token) return { ok: false, reason: 'invalid' };

  const invite = await db.adminInvite.findUnique({
    where:  { tokenHash: hashToken(token) },
    select: { email: true, role: true, expiresAt: true, acceptedAt: true },
  });

  if (!invite)                             return { ok: false, reason: 'invalid' };
  if (invite.acceptedAt)                   return { ok: false, reason: 'used' };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true, email: invite.email, role: invite.role as InviteRole };
}

export type AcceptResult =
  | { ok: true;  userId: string; email: string }
  | { ok: false; error: string };

/**
 * Consume an invite and set the account's password.
 *
 * Three properties worth stating explicitly, because each one is a security
 * decision rather than an implementation detail:
 *
 *  1. It does NOT touch mfaSecret / mfaEnabledAt. An invite is a password-setting
 *     mechanism, never a second-factor bypass — otherwise any admin able to send
 *     an invite could strip a colleague's 2FA and take their account.
 *  2. It revokes every existing session for the account. Setting a new password
 *     while old sessions keep working is the classic gap after a credential
 *     compromise; this closes it in the same transaction as the change.
 *  3. The invite is marked accepted with a guard on it still being unaccepted, so
 *     two people racing the same link cannot both set a password.
 */
export async function acceptInvite(token: string, password: string): Promise<AcceptResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const tokenHash = hashToken(token);
  const invite = await db.adminInvite.findUnique({
    where:  { tokenHash },
    select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true },
  });

  // One message for every failure mode of the token itself. Beyond this point a
  // caller already proved possession, so the distinction stops being useful and
  // starts being a probe surface.
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'This invitation link is no longer valid. Ask for a new one.' };
  }

  // Claim it first. updateMany with the unaccepted guard means the loser of a
  // race matches zero rows and stops here, before any password is written.
  const claimed = await db.adminInvite.updateMany({
    where: { id: invite.id, acceptedAt: null },
    data:  { acceptedAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: false, error: 'This invitation link is no longer valid. Ask for a new one.' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const user = await db.user.update({
    where:  { email: invite.email },
    data:   { passwordHash, role: invite.role, emailVerified: new Date() },
    select: { id: true, email: true },
  });

  // Any session that existed under the old credential is no longer trusted.
  await revokeAllForUser(user.id, null).catch(() => {});

  await db.auditLog.create({
    data: { actorId: user.id, action: 'admin.invite_accepted', target: invite.email },
  }).catch(() => {});

  return { ok: true, userId: user.id, email: user.email ?? invite.email };
}

/** Constant-time string compare, for callers comparing tokens outside the DB. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
