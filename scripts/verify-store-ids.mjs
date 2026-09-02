// Verifies the preferredStoreIds sanitiser in src/lib/store-ids.ts.
// Run with:  node --experimental-strip-types scripts/verify-store-ids.mjs
// Kept as a script rather than a test-runner suite because this repo has no
// test runner configured; it exits non-zero on failure so CI can call it.
//
// Regression guard for a real prod bug (2026-09-02): the sanitiser accepted
// only cuid-shaped ids, but every Store row migrated from the legacy Redis
// store has a dashed randomUUID id — all 8 prod stores at the time. The
// brand's map picks were silently dropped on every funnel submission.
//
// The shape cases below are pure (no DB). When DATABASE_URL is set, the script
// ALSO sweeps live Store ids so a third id shape appearing in prod fails this
// check instead of silently vanishing from campaigns again.

import { isStoreIdShaped, sanitizeStoreIds } from '../src/lib/store-ids.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

const CUID = 'cmf2xp4gh0001l704abcd1234';                 // Prisma cuid() default
const UUID = 'cb6486b7-5108-48e7-9bcf-53c096dc669c';      // real ALIVE store id

console.log('isStoreIdShaped — accepted shapes');
eq('cuid-shaped id accepted', isStoreIdShaped(CUID), true);
eq('uuid-shaped id accepted (the 2026-09-02 bug)', isStoreIdShaped(UUID), true);
eq('uppercase uuid rejected (Store ids are stored lowercase)',
  isStoreIdShaped(UUID.toUpperCase()), false);
eq('misplaced dashes rejected', isStoreIdShaped('cb6486b75-108-48e7-9bcf-53c096dc669c'), false);
eq('too-short opaque string rejected', isStoreIdShaped('abc123'), false);
eq('sql-ish string rejected', isStoreIdShaped("1;drop table \"Store\";--"), false);
eq('non-string rejected', isStoreIdShaped(42), false);

console.log('sanitizeStoreIds — filtering and caps');
eq('mixed shapes both survive, junk dropped',
  sanitizeStoreIds([CUID, 'nope', UUID, null, 7]), [CUID, UUID]);
eq('non-array input → empty', sanitizeStoreIds('not-an-array'), []);
eq('survivors capped at 50',
  sanitizeStoreIds(Array.from({ length: 80 }, () => UUID)).length, 50);
// 200-element pre-truncation: valid ids hidden past index 199 must not survive,
// or a hostile array could force per-element work on unbounded input.
eq('elements past 200 never examined',
  sanitizeStoreIds([...Array.from({ length: 200 }, () => 'junk'), UUID]), []);

if (process.env.DATABASE_URL) {
  console.log('prod sweep — every live Store.id must pass the sanitiser');
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    const stores = await db.store.findMany({ select: { id: true, storeName: true } });
    const rejected = stores.filter((s) => !isStoreIdShaped(s.id));
    eq(`all ${stores.length} live store ids accepted`,
      rejected.map((s) => `${s.id} (${s.storeName})`), []);
  } finally {
    await db.$disconnect();
  }
} else {
  console.log('prod sweep — skipped (no DATABASE_URL)');
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall checks passed');
