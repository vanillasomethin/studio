// POST /api/admin/login-link  — self-service console access.
// Body: { email }
//
// Someone types their work address on the sign-in screen and immediately gets a
// one-time link that lets them set a password. No admin has to invite them.
//
// WHY THIS IS SAFE DESPITE BEING PUBLIC: the link is only ever sent TO the
// address that was typed, and only company addresses are accepted. Typing a
// colleague's address just mails that colleague — the requester learns nothing
// and gains nothing. Security rests on control of an @wearealive.in mailbox,
// which is exactly what "sign in with your work email" means anywhere else.
//
// WHAT IT DOES MEAN — state it plainly: anyone who can read mail at
// @wearealive.in can make themselves a console admin. A mailbox that outlives
// someone's employment, or one that is compromised, is therefore full fleet
// access. Two mitigations here rather than a false sense of control:
//   • every request is written to the audit trail, and
//   • the FIRST time an address is seen, an admin WhatsApp alert fires, so a
//     stranger provisioning themselves is visible within seconds rather than at
//     the next audit review.
// Disabling a leaver's mailbox is the control that actually matters.
//
// Deliberately NOT an enumeration oracle: the response is identical whether the
// address exists, is new, or is refused for rate limiting. Only the domain check
// answers differently, because that is a rule the person needs to be told.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createInvite, isAllowedAdminEmail, ADMIN_EMAIL_DOMAIN } from '@/lib/admin-invite';
import { sendEmail, notifyAdminWA } from '@/lib/notify';
import { hitLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Same answer for every outcome past the domain check — see note above. */
const SAME_ANSWER = {
  ok: true,
  message: 'If that address can access the console, a sign-in link is on its way. Check your inbox.',
};

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:9002';
}

function linkEmailHtml(link: string, expiresAt: Date, isNew: boolean): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#111">
    <p style="margin:0 0 16px;font-size:15px">
      ${isNew
        ? 'Your ALIVE admin console account is ready to set up.'
        : 'Here is your sign-in link for the ALIVE admin console.'}
    </p>
    <p style="margin:0 0 20px">
      <a href="${link}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:600">Set your password</a>
    </p>
    <p style="margin:0 0 12px;line-height:1.55;color:#444">
      This link works <strong>once</strong> and expires on <strong>${expiresAt.toUTCString()}</strong>.
      You'll choose a password, then set up two-factor authentication — that step is
      required before the console will do anything.
    </p>
    <p style="margin:0;line-height:1.55;color:#666;font-size:13px">
      If you didn't ask for this, ignore it — nothing changes until someone opens
      this link and sets a password. If you keep receiving these, tell the team.
    </p>
  </div>`;
}

export async function POST(req: NextRequest) {
  const body  = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim().toLowerCase();

  // The one thing worth answering honestly: a personal address will never work,
  // and saying so stops someone retrying a gmail address forever.
  if (!isAllowedAdminEmail(email)) {
    return NextResponse.json(
      { ok: false, error: `Use your @${ADMIN_EMAIL_DOMAIN} work address.` },
      { status: 400 },
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip') ?? 'unknown';

  // Two limits, because they bound different abuses. Per-email stops mail-bombing
  // one person; per-IP stops someone walking the address space. Both fail OPEN
  // (Redis outage must not lock everyone out of the console), which is why the
  // audit row below is written regardless — a flood stays visible even when the
  // limiter is degraded.
  const emailLimit = await hitLimit(`admin:loginlink:email:${email}`, 3, 3600);
  const ipLimit    = await hitLimit(`admin:loginlink:ip:${ip}`, 10, 3600);
  if (emailLimit.limited || ipLimit.limited) {
    // Same answer as success: a different response here would turn the limiter
    // into the enumeration oracle the rest of this route avoids being.
    return NextResponse.json(SAME_ANSWER);
  }

  try {
    const existing = await db.user.findUnique({
      where:  { email },
      select: { id: true, role: true },
    });
    const isNew = !existing;

    // Someone who already holds a non-console role (a store partner or brand who
    // happens to have a company address) must not be silently promoted to ADMIN
    // by asking for a link. Refuse quietly — same answer, no account change.
    if (existing && existing.role !== 'ADMIN' && existing.role !== 'OPS') {
      await db.auditLog.create({
        data: {
          actorId: null, action: 'admin.login_link_refused', target: email, ip,
          meta: { reason: 'existing non-console role', role: existing.role },
        },
      }).catch(() => {});
      return NextResponse.json(SAME_ANSWER);
    }

    // createInvite upserts the account shell with NO passwordHash and mints a
    // single-use token whose SHA-256 is all that reaches the database.
    const { token, expiresAt } = await createInvite(email, 'ADMIN', null);
    const link = `${baseUrl()}/admin/setup?token=${encodeURIComponent(token)}`;

    const sent = await sendEmail(email, 'Your ALIVE admin sign-in link', linkEmailHtml(link, expiresAt, isNew));

    await db.auditLog.create({
      data: {
        actorId: null,
        action:  'admin.login_link_sent',
        target:  email,
        ip,
        userAgent: req.headers.get('user-agent') ?? null,
        // Never the token or the link — those are the credential.
        meta: { newAccount: isNew, emailDelivered: sent, rateLimitDegraded: emailLimit.degraded || ipLimit.degraded },
      },
    }).catch(() => {});

    // Real-time visibility on the only genuinely risky case: an address nobody
    // has seen before just granted itself console access.
    if (isNew) {
      void notifyAdminWA(
        `ALIVE security: a NEW console account was created by self-service.\n` +
        `Address: ${email}\nIP: ${ip}\n` +
        `If this is not someone who should have admin access, delete it now:\n` +
        `npx tsx scripts/delete-admin.ts ${email}`,
      );
    }

    // If mail could not be sent the account now exists but nobody can reach it.
    // Recorded above as emailDelivered:false; the caller still gets SAME_ANSWER
    // so the failure is not a signal an outsider can probe for.
    //
    // DEVELOPMENT ONLY: with no mail transport configured the whole flow is
    // untestable — you would click "email me a link" and wait forever. So on a
    // dev server, and only when the mail actually failed, the link comes back in
    // the response. Gated hard on NODE_ENV: in production this would hand a
    // valid sign-in token to whoever asked for it, which is the entire threat
    // this route is otherwise built to avoid.
    if (!sent && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        ...SAME_ANSWER,
        devLink: link,
        devNote: 'DEV ONLY — no mail transport configured. Configure EMAIL_SERVER_* or RESEND_API_KEY; this field never appears in production.',
      });
    }

    return NextResponse.json(SAME_ANSWER);
  } catch {
    // Including createInvite's domain guard throwing. Never leak which.
    return NextResponse.json(SAME_ANSWER);
  }
}
