// Creates (or refreshes) the named admin accounts from src/lib/admin-team.ts
// and prints each person's single-use invite link.
//
//   npm run admin:seed            # create/refresh, print links, send nothing
//   npm run admin:seed -- --send  # also email the invites
//
// Existing accounts are never overwritten: someone who has already set a
// password keeps it and is skipped. Re-running only re-issues invites for
// people who still have no password.
//
// Needs DATABASE_URL. --send additionally needs a mail transport: either
// ZOHO_SMTP_USER + ZOHO_SMTP_PASSWORD (an app-specific password from Zoho, not
// the account password), or RESEND_API_KEY.

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ADMIN_ROSTER, ADMIN_TEAM_LABEL } from '../src/lib/admin-team.ts';

const db = new PrismaClient();
const send = process.argv.includes('--send');
const baseUrl = process.env.ADMIN_BASE_URL ?? 'https://wearealive.in';

const SUBJECT = 'Your ALIVE admin login';

// Note we never email a password — only a single-use link the person uses to set
// their own. Nothing in this message is a credential someone else could reuse.
const inviteHtml = (name, link) => `
  <p>Hi ${name},</p>
  <p>You now have your own login for the ALIVE admin console. The shared
  password is being retired — from now on every change is recorded against
  the person who made it.</p>
  <p><a href="${link}">Set your password</a></p>
  <p>This link works once and is personal to you. If you did not expect it,
  reply to this email and we'll cancel it.</p>
  <p>— ALIVE</p>`;

const FROM = process.env.ADMIN_MAIL_FROM ?? 'ALIVE <hello@wearealive.in>';

/** Zoho Mail over SMTP. Use an app-specific password, not the account password. */
async function sendViaZoho(to, name, link) {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    // .in for Zoho India accounts; override with ZOHO_SMTP_HOST for .com/.eu
    host:   process.env.ZOHO_SMTP_HOST ?? 'smtp.zoho.in',
    port:   Number(process.env.ZOHO_SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  });
  await transport.sendMail({ from: FROM, to, subject: SUBJECT, html: inviteHtml(name, link) });
}

async function sendViaResend(to, name, link) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject: SUBJECT, html: inviteHtml(name, link) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`);
}

/** Zoho SMTP when configured (these are @wearealive.in mailboxes), else Resend. */
async function sendInvite(to, name, link) {
  if (process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASSWORD) return sendViaZoho(to, name, link);
  if (process.env.RESEND_API_KEY) return sendViaResend(to, name, link);
  throw new Error('No mail transport configured — set ZOHO_SMTP_USER + ZOHO_SMTP_PASSWORD, or RESEND_API_KEY');
}

async function main() {
  const results = [];

  for (const person of ADMIN_ROSTER) {
    const email = person.email.toLowerCase();
    const existing = await db.adminUser.findUnique({ where: { email } });

    if (existing?.passwordHash) {
      results.push({ ...person, status: 'already set up', link: null });
      continue;
    }

    const inviteToken = crypto.randomBytes(32).toString('base64url');
    if (existing) {
      await db.adminUser.update({
        where: { id: existing.id },
        data: { name: person.name, team: person.team, inviteToken, active: true },
      });
    } else {
      await db.adminUser.create({
        data: { email, name: person.name, team: person.team, inviteToken },
      });
    }
    results.push({ ...person, status: existing ? 're-invited' : 'created', link: `${baseUrl}/admin/accept-invite?token=${inviteToken}` });
  }

  console.log('\nALIVE admin accounts\n');
  for (const r of results) {
    console.log(`  ${r.name}  <${r.email}>  · ${ADMIN_TEAM_LABEL[r.team]}`);
    console.log(`    ${r.status}${r.link ? `\n    ${r.link}` : ''}\n`);
  }

  if (!send) {
    console.log('No email sent. Share the links above, or re-run with --send to email them.\n');
    return;
  }

  for (const r of results) {
    if (!r.link) continue;
    try {
      await sendInvite(r.email, r.name, r.link);
      console.log(`  sent → ${r.email}`);
    } catch (e) {
      console.error(`  FAILED → ${r.email}: ${e.message}`);
    }
  }
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
