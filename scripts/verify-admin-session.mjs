// Verifies src/lib/admin-session.ts — the admin console session token.
// Run: npm run verify:admin-session  (exits non-zero on failure)

process.env.AUTH_SECRET = 'test-secret-for-admin-session-verification';

const { signAdminSession, verifyAdminSession, ADMIN_COOKIE } =
  await import('../src/lib/admin-session.ts');

let f = 0;
const eq = (n, a, e) => {
  if (JSON.stringify(a) === JSON.stringify(e)) console.log('  ok  ', n);
  else { f++; console.error('  FAIL', n, '\n    expected', JSON.stringify(e), '\n    actual  ', JSON.stringify(a)); }
};

const arya = { id: 'adm_1', name: 'Arya', email: 'arya@wearealive.in', team: 'operations' };

const token = await signAdminSession(arya);
eq('round-trips the identity', await verifyAdminSession(token), arya);
eq('cookie name is stable', ADMIN_COOKIE, 'alive_admin_session');

eq('rejects empty token',     await verifyAdminSession(''), null);
eq('rejects null token',      await verifyAdminSession(null), null);
eq('rejects undefined token', await verifyAdminSession(undefined), null);
eq('rejects garbage',         await verifyAdminSession('not.a.jwt'), null);

// tampering with the payload must invalidate the signature
const [h, p, s] = token.split('.');
const forgedPayload = Buffer.from(JSON.stringify({
  ...JSON.parse(Buffer.from(p, 'base64url').toString()), team: 'founder',
})).toString('base64url');
eq('rejects a tampered payload', await verifyAdminSession(`${h}.${forgedPayload}.${s}`), null);
eq('rejects an unsigned token',  await verifyAdminSession(`${h}.${p}.`), null);

// a token signed with a different secret must not verify
process.env.AUTH_SECRET = 'a-completely-different-secret-value';
eq('rejects a token from another secret', await verifyAdminSession(token), null);
process.env.AUTH_SECRET = 'test-secret-for-admin-session-verification';
eq('accepts again once the secret is restored', (await verifyAdminSession(token))?.email, arya.email);

console.log(f === 0 ? '\nAdmin session token verified.' : `\n${f} failure(s).`);
process.exit(f === 0 ? 0 : 1);
