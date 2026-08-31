// Admin invite acceptance — how a named admin sets their first password.
//
//   GET  /api/admin/accept-invite?token=…              → whose invite is this?
//   POST /api/admin/accept-invite { token, password }  → set it, consume token
//
// Deliberately NOT behind the admin gate: the whole point is that the person
// has no way in yet. The single-use invite token is the credential, so it is
// cleared the moment a password is set.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, SESSION_HOURS, missingAdminSecrets, signAdminSession } from '@/lib/admin-session';

const MIN_PASSWORD = 10;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const admin = await db.adminUser.findUnique({
    where: { inviteToken: token },
    select: { name: true, email: true, team: true, active: true },
  });
  if (!admin || !admin.active) return NextResponse.json({ error: 'This invite link is no longer valid.' }, { status: 404 });

  return NextResponse.json({ name: admin.name, email: admin.email, team: admin.team });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { token?: string; password?: string } | null;
  const token    = body?.token?.trim() ?? '';
  const password = body?.password ?? '';

  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }

  // Check the environment before consuming the invite: the token is single-use,
  // so failing after the update would burn the link and leave the person with a
  // password but no session.
  const missing = missingAdminSecrets();
  if (missing.length > 0) {
    return NextResponse.json({
      error: `Admin sign-in is not configured on this environment — ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Your invite link is still valid; try again once it is.`,
    }, { status: 503 });
  }

  const admin = await db.adminUser.findUnique({ where: { inviteToken: token } });
  if (!admin || !admin.active) {
    return NextResponse.json({ error: 'This invite link is no longer valid.' }, { status: 404 });
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      inviteToken:  null,          // single use
      lastLoginAt:  new Date(),
    },
  });

  // Sign them straight in — they just proved control of the invite.
  const sessionToken = await signAdminSession({
    id: admin.id, name: admin.name, email: admin.email, team: admin.team,
  });
  const res = NextResponse.json({ ok: true, name: admin.name });
  res.cookies.set(ADMIN_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   SESSION_HOURS * 60 * 60,
  });
  return res;
}
