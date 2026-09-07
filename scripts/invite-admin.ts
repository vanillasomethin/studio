// Invite a console account. The invitee sets their own password from an emailed
// link — nobody else ever knows it, including whoever runs this.
//
//   npx tsx scripts/invite-admin.ts deepak@wearealive.in
//   npx tsx scripts/invite-admin.ts ops@wearealive.in --ops
//
// This is the BOOTSTRAP path. Normally invitations are sent from Admin → Team,
// but that needs an existing admin to be signed in — so the first individual
// account has to be created here. After that, use the console.
//
// Deliberately different from create-admin.mjs, which sets a password directly.
// That script exists for recovery (a locked-out admin resetting their own
// password); this one is how a NEW person joins, and it never produces a
// password anyone but them has seen.
//
// ⚠ WRITES TO WHATEVER DATABASE_URL POINTS AT — in this repo, production.

import 'dotenv/config';
import { createInvite, isAllowedAdminEmail, ADMIN_EMAIL_DOMAIN } from '../src/lib/admin-invite';
import { sendEmail } from '../src/lib/notify';
import { db } from '../src/lib/db';

const args  = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
const role  = args.includes('--ops') ? 'OPS' : 'ADMIN';

if (!email) {
  console.error('\n  Usage: npx tsx scripts/invite-admin.ts <email@wearealive.in> [--ops]\n');
  process.exit(1);
}
if (!isAllowedAdminEmail(email)) {
  console.error(`\n  "${email}" is not a @${ADMIN_EMAIL_DOMAIN} address.`);
  console.error('  Console accounts must be on the company domain — a personal address');
  console.error('  would keep working after the person leaves.\n');
  process.exit(1);
}

const baseUrl =
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  'http://localhost:9002';

// Wrapped in an async IIFE rather than using top-level await: this repo's
// tsconfig makes tsx emit CommonJS, where top-level await is a hard error.
void (async () => {
try {
  const host = (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`\n  Target database : ${host || '(DATABASE_URL unset)'}`);
  console.log(`  Inviting        : ${email}  [${role}]`);
  console.log(`  Setup links to  : ${baseUrl}/admin/setup\n`);

  // invitedBy is null: this is the bootstrap path, so there may be no admin to
  // attribute it to. Invitations sent from the console carry the sender's id.
  const { token, expiresAt, isExistingUser } = await createInvite(email, role, null);
  const link = `${baseUrl}/admin/setup?token=${encodeURIComponent(token)}`;

  if (isExistingUser) {
    console.log('  NOTE: this account already has a password. Accepting the invite');
    console.log('        replaces it and signs them out everywhere. Their 2FA is untouched.\n');
  }

  const sent = await sendEmail(
    email,
    'Set up your ALIVE admin account',
    `<div style="font-family:system-ui,sans-serif;max-width:520px">
       <p>You've been given access to the ALIVE admin console as <strong>${role}</strong>.</p>
       <p><a href="${link}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:600">Set your password</a></p>
       <p style="color:#444;line-height:1.55">This link works once and expires on <strong>${expiresAt.toUTCString()}</strong>. After setting a password you'll be asked to set up two-factor authentication — that step is required before you can use the console.</p>
     </div>`,
  );

  if (sent) {
    console.log(`  ✔ Invitation emailed to ${email}`);
    console.log(`    Expires ${expiresAt.toUTCString()}\n`);
  } else {
    // Never silently "succeed": an unsent invite leaves a password-less account
    // and a person waiting for mail that will never arrive.
    console.log('  ⚠ EMAIL NOT SENT — no mail transport is configured.');
    console.log('    Set RESEND_API_KEY, or EMAIL_SERVER_HOST/USER/PASSWORD for Gmail.');
    console.log('    Send this one-time link to them yourself:\n');
    console.log(`    ${link}\n`);
    console.log(`    Expires ${expiresAt.toUTCString()}\n`);
  }
} catch (err) {
  console.error(`\n  Failed: ${(err as Error).message}\n`);
  process.exit(1);
} finally {
  await db.$disconnect();
}
})();
