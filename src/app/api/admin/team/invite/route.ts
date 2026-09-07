// POST /api/admin/team/invite — invite a colleague as ADMIN or OPS.
// Body: { email, role }
//
// Auth: a NAMED admin session. The shared ADMIN_PASSWORD is explicitly refused
// here even though it satisfies requireAdmin elsewhere: creating an admin
// account is a privilege-granting act, and one performed by a secret that
// several people know is unattributable by construction. "Who added arya@?" must
// always have an answer, which a shared credential cannot give.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { createInvite, isAllowedAdminEmail, ADMIN_EMAIL_DOMAIN, type InviteRole } from '@/lib/admin-invite';
import { sendEmail } from '@/lib/notify';

/** Where the setup link points. Vercel sets VERCEL_URL without a scheme. */
function baseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL)   return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:9002';
}

function inviteEmailHtml(link: string, role: InviteRole, invitedBy: string, expiresAt: Date): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#111">
      <h2 style="margin:0 0 16px;font-weight:800;letter-spacing:-0.02em">You've been added to the ALIVE admin console</h2>
      <p style="margin:0 0 12px;line-height:1.55">
        ${invitedBy} has created an <strong>${role}</strong> account for you.
        Set your password to finish:
      </p>
      <p style="margin:0 0 20px">
        <a href="${link}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:600">Set your password</a>
      </p>
      <p style="margin:0 0 12px;line-height:1.55;color:#444">
        This link works once and expires on
        <strong>${expiresAt.toUTCString()}</strong>.
        After setting a password you'll be asked to set up two-factor
        authentication — that step is required before you can use the console.
      </p>
      <p style="margin:0;line-height:1.55;color:#666;font-size:13px">
        If you weren't expecting this, ignore it and tell hello@wearealive.in —
        the account cannot be used until someone sets a password with this link.
      </p>
    </div>`;
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  if (actor.kind !== 'user') {
    return NextResponse.json(
      { error: 'Inviting requires a named admin account, not the shared password.' },
      { status: 403 },
    );
  }

  const body  = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  const role  = body.role === 'OPS' ? 'OPS' : 'ADMIN';

  // Deliberately strict rather than clever: a typo'd address sends a working
  // setup link to a stranger.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  // Company domain only. createInvite enforces this too, but it throws — this
  // turns it into a message the person typing actually sees.
  if (!isAllowedAdminEmail(email)) {
    return NextResponse.json(
      { error: `Console accounts must be @${ADMIN_EMAIL_DOMAIN} addresses. A personal address would keep working after someone leaves.` },
      { status: 400 },
    );
  }

  const { token, expiresAt, isExistingUser } = await createInvite(email, role, actor.userId);
  const link = `${baseUrl()}/admin/setup?token=${encodeURIComponent(token)}`;

  const sent = await sendEmail(
    email,
    'Set up your ALIVE admin account',
    inviteEmailHtml(link, role, actor.label, expiresAt),
  );

  // The raw token is never logged — the audit trail records that an invite
  // happened and to whom, which is the accountability question, not the secret.
  await logAdminAction({
    actor, action: 'admin.invite_created', target: email,
    meta: { role, emailDelivered: sent, wasExistingUser: isExistingUser }, req,
  });

  return NextResponse.json({
    ok: true,
    email,
    role,
    expiresAt,
    emailSent: sent,
    // Surfaced so the console can show the link when mail is not configured,
    // instead of silently leaving the person stranded. Returned ONLY to the
    // admin who just created it, over their authenticated request.
    setupLink: sent ? undefined : link,
    warning: sent
      ? undefined
      : 'Email could not be sent (RESEND_API_KEY missing or rejected). Share the link below yourself — it works once and expires in 48 hours.',
    // A re-invite for someone who already has a password will REPLACE it when
    // they accept, so the console can warn before that surprises anyone.
    replacesExistingPassword: isExistingUser,
  });
}
