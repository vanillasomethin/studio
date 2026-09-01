// Admin TOTP enrolment.
//
// GET    /api/admin/mfa  → { enrolled, email }        — current 2FA state
// POST   /api/admin/mfa  → { secret, otpauthUri }     — begin enrolment
// PUT    /api/admin/mfa  → { ok }                     — activate with first code
// DELETE /api/admin/mfa  → { ok }                     — remove 2FA
//
// AUTH: every method here requires a *named session* (actor.kind === 'user').
// The shared ADMIN_PASSWORD is explicitly NOT sufficient, even though
// requireAdmin() accepts it elsewhere. Two reasons:
//
//   1. Enrolment has to target a specific person, and a shared secret has no
//      subject — there is no account to attach the seed to.
//   2. Otherwise anyone holding the leaked shared password could bind their own
//      authenticator to an admin account and gain a durable foothold that
//      survives rotating the very password they stole. That would make this
//      endpoint a privilege-escalation primitive rather than a hardening one.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { generateSecret, otpauthUri, verifyTotpStep } from '@/lib/totp';
import { generateBackupCodes } from '@/lib/mfa-backup';
import { hitLimit, clearLimit } from '@/lib/rate-limit';

/** Resolve the acting admin, or null unless they hold a real named session. */
async function namedAdmin(req: NextRequest) {
  // allowMfaPending: a just-logged-in admin who hasn't enrolled 2FA yet (mfa=false)
  // must still be able to reach THIS route to enrol — requireAdmin blocks such a
  // session everywhere else.
  const actor = await requireAdmin(req, { allowMfaPending: true });
  if (!actor || actor.kind !== 'user') return null;
  return actor;
}

const NEEDS_SESSION = {
  error: 'This action requires signing in as a named admin account, not the shared password.',
};

export async function GET(req: NextRequest) {
  const actor = await namedAdmin(req);
  if (!actor) return NextResponse.json(NEEDS_SESSION, { status: 401 });

  const user = await db.user.findUnique({
    where:  { id: actor.userId },
    select: { email: true, mfaEnabledAt: true },
  });
  return NextResponse.json({
    enrolled: !!user?.mfaEnabledAt,
    email:    user?.email ?? null,
  });
}

export async function POST(req: NextRequest) {
  const actor = await namedAdmin(req);
  if (!actor) return NextResponse.json(NEEDS_SESSION, { status: 401 });

  const user = await db.user.findUnique({
    where:  { id: actor.userId },
    select: { email: true, mfaEnabledAt: true },
  });

  // Re-enrolling an active authenticator would silently invalidate it; require
  // an explicit DELETE first so losing 2FA is always a deliberate act.
  if (user?.mfaEnabledAt) {
    return NextResponse.json(
      { error: '2FA is already active. Remove it first to re-enrol.' },
      { status: 409 },
    );
  }

  // Stored immediately but NOT trusted: mfaEnabledAt stays null until a code
  // proves the authenticator actually holds this seed. An abandoned enrolment
  // therefore leaves the account exactly as it was.
  const secret = generateSecret();
  await db.user.update({ where: { id: actor.userId }, data: { mfaSecret: secret } });

  return NextResponse.json({
    secret,
    otpauthUri: otpauthUri(secret, user?.email ?? actor.label),
  });
}

export async function PUT(req: NextRequest) {
  const actor = await namedAdmin(req);
  if (!actor) return NextResponse.json(NEEDS_SESSION, { status: 401 });

  // Activation verifies a code, so it is guessable and must be throttled just
  // like login — otherwise it is a second, unprotected door to the same check.
  const key = `admin:mfa:activate:${actor.userId}`;
  if ((await hitLimit(key, 8, 900)).limited) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await db.user.findUnique({
    where:  { id: actor.userId },
    select: { mfaSecret: true, mfaEnabledAt: true },
  });

  if (!user?.mfaSecret) {
    return NextResponse.json({ error: 'Start enrolment first.' }, { status: 400 });
  }
  const step = verifyTotpStep(user.mfaSecret, code ?? '');
  if (step === null) {
    return NextResponse.json({ error: 'That code is not valid.' }, { status: 400 });
  }

  // Issued in the same write that enables 2FA, so an account can never be
  // enrolled without a way back in. Returned exactly once — nothing stores the
  // plaintext, and no endpoint can produce it again.
  const { plain, hashes } = await generateBackupCodes();

  // Record the step as spent in the same write that enables 2FA, so the very
  // code that activated it can't be turned around and replayed at the login
  // screen while it is still inside its ~90s validity window.
  await db.user.update({
    where: { id: actor.userId },
    data:  {
      mfaEnabledAt: new Date(),
      mfaLastStep: step,
      mfaBackupCodes: hashes,
      mfaBackupCodesAt: new Date(),
    },
  });
  await clearLimit(key);
  await logAdminAction({ actor, req, action: 'admin.mfa.enable', target: actor.userId });

  return NextResponse.json({ ok: true, backupCodes: plain });
}

// PATCH /api/admin/mfa → { backupCodes } — reissue recovery codes.
//
// Requires a current TOTP code, not merely a session: reissuing invalidates
// every existing code, so a stolen session must not be able to silently swap an
// operator's recovery set for one the thief holds.
export async function PATCH(req: NextRequest) {
  const actor = await namedAdmin(req);
  if (!actor) return NextResponse.json(NEEDS_SESSION, { status: 401 });

  const key = `admin:mfa:codes:${actor.userId}`;
  if ((await hitLimit(key, 8, 900)).limited) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await db.user.findUnique({
    where:  { id: actor.userId },
    select: { mfaSecret: true, mfaEnabledAt: true, mfaLastStep: true },
  });
  if (!user?.mfaEnabledAt || !user.mfaSecret) {
    return NextResponse.json({ error: '2FA is not active on this account.' }, { status: 400 });
  }

  const step = verifyTotpStep(user.mfaSecret, code ?? '');
  if (step === null || (user.mfaLastStep !== null && step <= user.mfaLastStep)) {
    return NextResponse.json({ error: 'A current 2FA code is required.' }, { status: 400 });
  }

  const { plain, hashes } = await generateBackupCodes();
  // Spend the step in the same write, so the code that authorised the reissue
  // cannot also be replayed at the login screen.
  await db.user.update({
    where: { id: actor.userId },
    data:  { mfaLastStep: step, mfaBackupCodes: hashes, mfaBackupCodesAt: new Date() },
  });
  await clearLimit(key);
  await logAdminAction({ actor, req, action: 'admin.mfa.codes.reissue', target: actor.userId });

  return NextResponse.json({ ok: true, backupCodes: plain });
}

export async function DELETE(req: NextRequest) {
  const actor = await namedAdmin(req);
  if (!actor) return NextResponse.json(NEEDS_SESSION, { status: 401 });

  // Removing a second factor is a downgrade in protection, so it demands a
  // current code — a stolen *session* alone must not be enough to strip 2FA and
  // leave the account defended by a password the thief may already have.
  const key = `admin:mfa:remove:${actor.userId}`;
  if ((await hitLimit(key, 8, 900)).limited) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await db.user.findUnique({
    where:  { id: actor.userId },
    select: { mfaSecret: true, mfaEnabledAt: true, mfaLastStep: true },
  });

  if (user?.mfaEnabledAt) {
    const step = user.mfaSecret ? verifyTotpStep(user.mfaSecret, code ?? '') : null;
    // Single-use applies here most of all: stripping the second factor is the
    // most damaging thing a stolen session can do, so a replayed code must not
    // be able to do it.
    if (step === null || (user.mfaLastStep !== null && step <= user.mfaLastStep)) {
      return NextResponse.json({ error: 'A current 2FA code is required.' }, { status: 400 });
    }
  }

  await db.user.update({
    where: { id: actor.userId },
    // Codes are a second factor in their own right, so removing 2FA must
    // revoke them too — otherwise a stale set would still open the account.
    data:  { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null, mfaBackupCodes: [], mfaBackupCodesAt: null },
  });
  await clearLimit(key);
  await logAdminAction({ actor, req, action: 'admin.mfa.disable', target: actor.userId });

  return NextResponse.json({ ok: true });
}
