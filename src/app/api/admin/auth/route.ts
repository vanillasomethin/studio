import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, SESSION_HOURS, signAdminSession } from '@/lib/admin-session';

// ─── POST — sign in to the admin console ──────────────────────────────────────
//
// Named accounts: each person signs in with their own email + password so every
// audited action names a real person. On success we set an httpOnly session
// cookie; middleware exchanges it for the shared secret downstream, so the
// browser never holds ADMIN_PASSWORD.
//
// Two compatibility paths remain, both deliberately narrow:
//   • No AdminUser rows yet  → the shared ADMIN_PASSWORD still works, so the
//     first person in can create the real accounts instead of being locked out.
//   • ADMIN_PASSWORD unset   → dev mode, as before.
// Once a single admin account exists, the shared password stops being accepted.

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
  const shared = process.env.ADMIN_PASSWORD;

  if (!shared) {
    // Dev mode — no secret configured, allow in as before.
    const token = await signAdminSession({ id: 'dev', name: 'Dev admin', email: '', team: 'tech' })
      .catch(() => null);
    const res = NextResponse.json({ ok: true });
    return token ? setSession(res, token) : res;
  }

  if (accountCount > 0) {
    return NextResponse.json(
      { ok: false, error: 'The shared password has been retired. Sign in with your own email.' },
      { status: 401 },
    );
  }

  if (password === shared) {
    const token = await signAdminSession({ id: 'bootstrap', name: 'Shared admin', email: '', team: 'tech' })
      .catch(() => null);
    const res = NextResponse.json({ ok: true, bootstrap: true });
    return token ? setSession(res, token) : res;
  }

  return invalid();
}

// ─── DELETE — sign out ────────────────────────────────────────────────────────

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
