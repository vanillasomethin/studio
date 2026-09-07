// Invitation acceptance — PUBLIC BY DESIGN.
//
//   GET  /api/invite/accept?token=…   → is this link usable? (renders the page)
//   POST /api/invite/accept           → { token, password } sets the password
//
// Deliberately NOT under /api/admin/*. Everything there is expected to be
// credential-guarded, and an unguarded route sitting among them is exactly the
// shape a future audit flags as a hole — or worse, that someone "fixes" by
// adding a guard, which would make invitations impossible to accept. The token
// IS the credential here: 256 bits, single-use, 48-hour lifetime, and stored
// only as a SHA-256 hash (see @/lib/admin-invite).

import { NextRequest, NextResponse } from 'next/server';
import { checkInvite, acceptInvite, MIN_PASSWORD_LENGTH } from '@/lib/admin-invite';
import { hitLimit } from '@/lib/rate-limit';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const result = await checkInvite(token);
  // Always 200: this is a page-rendering probe, and the body already says
  // whether the link is usable. A 4xx here would just be noise in telemetry.
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  // Guessing a 256-bit token is not a realistic attack, so this limit is not
  // the security boundary — it just stops the endpoint being a free bcrypt-cost
  // amplifier (each attempt costs a deliberately slow hash).
  const limit = await hitLimit(`invite:accept:${clientIp(req)}`, 20, 900);
  if (limit.limited) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }

  const body     = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token    = (body.token ?? '').trim();
  const password = body.password ?? '';

  if (!token) {
    return NextResponse.json({ error: 'Missing invitation token.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const result = await acceptInvite(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // No session is minted here on purpose. The person now signs in through the
  // normal admin door, which forces them through 2FA enrolment — so the account
  // cannot end up password-only just because it was created by invitation.
  return NextResponse.json({ ok: true, email: result.email });
}
