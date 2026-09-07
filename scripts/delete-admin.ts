// Remove a console account.
//
//   npx tsx scripts/delete-admin.ts hello@wearealive.in
//
// Deleting the User row cascades its AdminSession rows away, so every device
// that account was signed in on stops working immediately — that is the point.
//
// AuditLog is deliberately NOT cascaded: `actorId` is a plain column with no
// foreign key, so everything the person did stays in the history with the email
// label captured at write time. Deleting someone must not delete the record of
// what they changed.
//
// LOCKOUT GUARD: refuses to remove the last account that can actually sign in
// (password set AND 2FA enrolled), unless --force. Without that check, running
// this on your only admin leaves the console reachable only via the shared
// ADMIN_PASSWORD — which is the thing this whole migration exists to retire.
//
// ⚠ WRITES TO WHATEVER DATABASE_URL POINTS AT — in this repo, production.

import 'dotenv/config';
import readline from 'node:readline';
import { db } from '../src/lib/db';

const args  = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
const force = args.includes('--force');

if (!email) {
  console.error('\n  Usage: npx tsx scripts/delete-admin.ts <email> [--force]\n');
  process.exit(1);
}

function ask(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); resolve(a); });
  });
}

// Wrapped in an async IIFE rather than using top-level await: this repo's
// tsconfig makes tsx emit CommonJS, where top-level await is a hard error.
void (async () => {
try {
  const host = (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`\n  Target database : ${host || '(DATABASE_URL unset)'}`);
  console.log(`  Deleting        : ${email}\n`);

  const user = await db.user.findUnique({
    where:  { email },
    select: { id: true, email: true, role: true, passwordHash: true, mfaEnabledAt: true },
  });
  if (!user) {
    console.log('  No such account — nothing to do.\n');
    process.exit(0);
  }
  if (user.role !== 'ADMIN' && user.role !== 'OPS') {
    console.error(`  ${email} is a ${user.role}, not a console account. Refusing.\n`);
    process.exit(1);
  }

  // Count who could still sign in afterwards. "Usable" means a password AND an
  // enrolled second factor — an account missing either cannot complete a login,
  // so counting it would make this guard lie.
  const remaining = await db.user.count({
    where: {
      role:         { in: ['ADMIN', 'OPS'] },
      id:           { not: user.id },
      passwordHash: { not: null },
      mfaEnabledAt: { not: null },
    },
  });

  const sessions = await db.adminSession.count({ where: { userId: user.id, revokedAt: null } });
  console.log(`  role            : ${user.role}`);
  console.log(`  password set    : ${user.passwordHash ? 'yes' : 'no'}`);
  console.log(`  2FA enrolled    : ${user.mfaEnabledAt ? 'yes' : 'no'}`);
  console.log(`  live sessions   : ${sessions}  (these end immediately)`);
  console.log(`  other usable admins after this: ${remaining}\n`);

  if (remaining === 0 && !force) {
    console.error('  REFUSING: this is the last account that can sign in.');
    console.error('  Deleting it leaves the console reachable only via the shared');
    console.error('  ADMIN_PASSWORD — the exact thing named accounts replace.\n');
    console.error('  Create and VERIFY a replacement first:');
    console.error('    npx tsx scripts/invite-admin.ts you@wearealive.in');
    console.error('  then sign in as them, enrol 2FA, and re-run this.\n');
    console.error('  Override with --force only if you accept that consequence.\n');
    process.exit(1);
  }
  if (remaining === 0 && force) {
    console.log('  ⚠ --force: no usable admin will remain. The console will be');
    console.log('    reachable only with the shared ADMIN_PASSWORD.\n');
  }

  if ((await ask(`  Type the email to confirm deletion: `)).trim().toLowerCase() !== email) {
    console.log('  Did not match — aborted, nothing deleted.\n');
    process.exit(0);
  }

  // Recorded BEFORE the delete: afterwards there is no actor left to attribute
  // it to, and an unexplained disappearance is exactly what an audit trail is for.
  await db.auditLog.create({
    data: {
      actorId: null,
      action:  'admin.account_deleted',
      target:  email,
      meta:    { role: user.role, via: 'scripts/delete-admin.ts', liveSessionsEnded: sessions, forced: force },
    },
  }).catch(() => {});

  await db.user.delete({ where: { id: user.id } });

  console.log(`\n  ✔ Deleted ${email}. ${sessions} session(s) ended.`);
  console.log('    Their audit history is retained.\n');
} catch (err) {
  console.error(`\n  Failed: ${(err as Error).message}\n`);
  process.exit(1);
} finally {
  await db.$disconnect();
}
})();
