#!/usr/bin/env node
// Create or promote a named ADMIN/OPS account for the console.
//
//   node scripts/create-admin.mjs you@wearealive.in            → ADMIN
//   node scripts/create-admin.mjs ops@wearealive.in --ops      → OPS
//
// This is the bootstrap for moving off the shared ADMIN_PASSWORD: named accounts
// have to exist before anyone can sign in with 2FA. It does NOT enrol 2FA — the
// operator does that from the console after their first sign-in, so the TOTP
// seed is only ever generated on the machine holding the authenticator.
//
// ⚠ WRITES TO WHATEVER DATABASE_URL POINTS AT. In this repo the local .env
// points at the PRODUCTION Neon database, which is exactly right for creating a
// real admin — but it means this is not a dry run. It prints the target host and
// waits for confirmation before writing.
//
// The password is read from a hidden prompt, never from argv (shell history) and
// never from an env var (leaks into process listings and CI logs). Only the
// bcrypt hash is stored.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

const args  = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
const role  = args.includes('--ops') ? 'OPS' : 'ADMIN';

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/create-admin.mjs <email> [--ops]');
  process.exit(1);
}

// Company domain only — the same rule as src/lib/admin-invite.ts
// (isAllowedAdminEmail). Duplicated rather than imported because this is a plain
// .mjs script and cannot import the TypeScript lib; kept deliberately identical,
// including PARSING rather than suffix-matching, since
// endsWith('@wearealive.in') would accept `attacker@evil.com@wearealive.in`.
//
// Without this check the script would happily mint a gmail.com ADMIN row. It
// could not actually sign in — authorize() re-checks the domain — but it would
// appear in Admin → Team as a real account, and relying on one downstream guard
// is how the original fail-open bug happened.
const ADMIN_EMAIL_DOMAIN = 'wearealive.in';
const parts = email.split('@');
if (parts.length !== 2 || !parts[0] || parts[1] !== ADMIN_EMAIL_DOMAIN) {
  console.error(`\n  "${email}" is not an @${ADMIN_EMAIL_DOMAIN} address.`);
  console.error('  Console accounts must be on the company domain — a personal');
  console.error('  address would keep working after the person leaves.\n');
  process.exit(1);
}

/** Prompt without echoing keystrokes. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      // Re-render the prompt without the typed characters.
      if (!['\n', '\r', ''].includes(char.toString('utf8'))) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(question);
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a); });
  });
}

const db = new PrismaClient();

try {
  // Show which database is about to be written to, with credentials stripped.
  const host = (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`\n  Target database : ${host || '(DATABASE_URL unset)'}`);
  console.log(`  Account         : ${email}`);
  console.log(`  Role            : ${role}\n`);

  const existing = await db.user.findUnique({
    where:  { email },
    select: { id: true, role: true, mfaEnabledAt: true },
  });
  if (existing) {
    console.log(`  NOTE: this user already exists (role ${existing.role}, ` +
                `2FA ${existing.mfaEnabledAt ? 'enabled' : 'not enrolled'}).`);
    console.log('  Continuing will set their role and REPLACE their password.\n');
  }

  if ((await ask('  Type "yes" to proceed: ')).trim().toLowerCase() !== 'yes') {
    console.log('  Aborted — nothing written.');
    process.exit(0);
  }

  const pw1 = await askHidden('  New password (min 8 chars): ');
  if (pw1.length < 8) {
    console.error('  Too short — an admin password guards the whole fleet. Aborted.');
    process.exit(1);
  }
  if (pw1 !== (await askHidden('  Confirm password           : '))) {
    console.error('  Passwords did not match. Aborted.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(pw1, 12);

  // Deliberately does NOT touch mfaSecret/mfaEnabledAt: re-running this to reset
  // a forgotten password must never silently strip an operator's 2FA.
  const user = await db.user.upsert({
    where:  { email },
    update: { role, passwordHash },
    create: { email, role, passwordHash, name: email.split('@')[0] },
  });

  console.log(`\n  ✔ ${existing ? 'Updated' : 'Created'} ${role} account: ${user.email}`);
  console.log('    Next: sign in at /admin, then enrol 2FA immediately.');
  console.log('    Until 2FA is enrolled this account is password-only.\n');
} catch (err) {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
} finally {
  await db.$disconnect();
}
