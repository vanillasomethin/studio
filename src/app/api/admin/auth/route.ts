import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, SESSION_HOURS, missingAdminSecrets, signAdminSession } from '@/lib/admin-session';

// ─── POST — sign in to the admin console ──────────────────────────────────────
//
// Named accounts: each person signs in with their own email + password so every
// audited action names a real person. On success we set an httpOnly session
// cookie; middleware exchanges it for the shared secret downstream, so the
// browser never holds ADMIN_PASSWORD.
//
// Two compatibility paths remain, both deliberately narrow:
//   • No AdminUser rows yet → the shared ADMIN_PASSWORD still works, so the
//     first person in can create the real accounts instead of being locked out.
// Once a single admin account exists the shared password stops being accepted,
// and with ADMIN_PASSWORD unset nobody gets in at all (fail closed).

type Body = { email?: string; password?: string };

const invalid = () => NextResponse.json({ ok: false, error: 'Incorrect email or password.' }, { status: 401 });

function setSession(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   SESSION_HOURS * 60 * 60,
  });
  return res;
}

export async function POST(req: NextRequest) {
  // Refuse before checking anybody's password: without both secrets a sign-in
  // that "succeeds" drops the person into a console where every panel answers
  // Unauthorized. Better to say which variable is missing than to let them in
  // to something broken.
  const missing = missingAdminSecrets();
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Admin sign-in is not configured on this environment — ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
    }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as Body | null;
  const email    = body?.email?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';

  const accountCount = await db.adminUser.count({ where: { active: true } }).catch(() => 0);

  // ── Named account sign-in ──
  if (email) {
    const admin = await db.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.active || !admin.passwordHash) return invalid();
    if (!(await bcrypt.compare(password, admin.passwordHash))) return invalid();

    await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

    const token = await signAdminSession({
      id: admin.id, name: admin.name, email: admin.email, team: admin.team,
    });
    return setSession(
      NextResponse.json({ ok: true, admin: { name: admin.name, email: admin.email, team: admin.team } }),
      token,
    );
  }

  // ── Legacy shared password ──
  // Guaranteed non-empty: missingAdminSecrets() above already refused an
  // environment without ADMIN_PASSWORD, so there is no dev bypass to fall into.
  const shared = process.env.ADMIN_PASSWORD!;

  if (accountCount > 0) {
    return NextResponse.json(
      { ok: false, error: 'The shared password has been retired. Sign in with your own email.' },
      { status: 401 },
    );
  }

  if (password === shared) {
    // Deliberately not caught: a session that cannot be signed is a failed
    // sign-in, not a successful one with the cookie quietly missing.
    const token = await signAdminSession({ id: 'bootstrap', name: 'Shared admin', email: '', team: 'tech' });
    return setSession(NextResponse.json({ ok: true, bootstrap: true }), token);
  }

  return invalid();
}

// ─── DELETE — sign out ────────────────────────────────────────────────────────

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
