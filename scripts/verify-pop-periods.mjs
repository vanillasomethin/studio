// Verifies the proof-of-play archive's period arithmetic (src/lib/pop-export.ts).
// Run with:  node --experimental-strip-types scripts/verify-pop-periods.mjs
// Kept as a script rather than a test-runner suite because this repo has no
// test runner configured; it exits non-zero on failure so CI can call it.
//
// Everything here is pure — no DB, no R2. The invariants under test are the
// ones the archive's "nothing missing, nothing double-exported" guarantee
// rests on:
//   • periods tile exactly: next period starts at the previous watermark
//   • the current (incomplete) month is never due
//   • IST month edges, not UTC — a play at 00:30 IST on the 1st belongs to the
//     new month even though its UTC timestamp is still in the old one

import { pendingPeriod, addMonthKeys, istStamp } from '../src/lib/pop-export.ts';
import { monthWindow } from '../src/lib/store-payout.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('addMonthKeys');
eq('same year', addMonthKeys('2026-03', 2), '2026-05');
eq('year rollover', addMonthKeys('2026-12', 1), '2027-01');
eq('bimonthly rollover', addMonthKeys('2026-11', 2), '2027-01');

console.log('IST month edges (monthWindow)');
eq('Aug 2026 ends 18:30Z on the 31st', monthWindow('2026-08').end.toISOString(), '2026-08-31T18:30:00.000Z');
eq('Sep 2026 starts where Aug ends', monthWindow('2026-09').start.toISOString(), '2026-08-31T18:30:00.000Z');

console.log('istStamp');
eq('UTC afternoon renders as IST evening', istStamp(new Date('2026-09-07T12:34:56.000Z')), '2026-09-07 18:04:56');
eq('IST midnight boundary', istStamp(new Date('2026-08-31T18:30:00.000Z')), '2026-09-01 00:00:00');

console.log('pendingPeriod — monthly');
const sep7 = new Date('2026-09-07T05:00:00.000Z');
eq('no data at all → nothing due', pendingPeriod(null, null, 1, sep7), null);

// First export ever: history starts mid-June → June is the first period.
const firstPlay = new Date('2026-06-15T10:00:00.000Z');
const june = pendingPeriod(null, firstPlay, 1, sep7);
eq('first export starts at the first month of history', june?.label, '2026-06');
eq('first export start is the IST June edge', june?.start.toISOString(), '2026-05-31T18:30:00.000Z');

// Watermark at the Sep 1 IST edge, today is Sep 7 → September is incomplete.
const sep1Edge = monthWindow('2026-09').start;
eq('current month is never exported', pendingPeriod(sep1Edge, null, 1, sep7), null);

// Watermark at the Aug 1 IST edge → August is complete and due.
const aug1Edge = monthWindow('2026-08').start;
const aug = pendingPeriod(aug1Edge, null, 1, sep7);
eq('completed month is due', aug?.label, '2026-08');
eq('periods tile: start === watermark', aug?.start.getTime(), aug1Edge.getTime());
eq('period end is the Sep 1 IST edge', aug?.end.toISOString(), '2026-08-31T18:30:00.000Z');

// Due the very instant the period completes, not a moment before.
eq('due exactly at the boundary', pendingPeriod(aug1Edge, null, 1, monthWindow('2026-08').end)?.label, '2026-08');
eq('not due 1ms before the boundary', pendingPeriod(aug1Edge, null, 1, new Date(monthWindow('2026-08').end.getTime() - 1)), null);

console.log('pendingPeriod — bi-monthly');
const jul1Edge = monthWindow('2026-07').start;
const julAug = pendingPeriod(jul1Edge, null, 2, sep7);
eq('two completed months are due as one period', julAug?.label, '2026-07_2026-08');
eq('bi-monthly period spans both months', julAug?.end.toISOString(), '2026-08-31T18:30:00.000Z');
eq('bi-monthly not due after only one month', pendingPeriod(jul1Edge, null, 2, new Date('2026-08-15T00:00:00.000Z')), null);

// Catch-up: a long-stalled watermark surfaces the OLDEST period first; the
// daily sweep drains the backlog one period per run.
const may1Edge = monthWindow('2026-05').start;
eq('backlog exports oldest first', pendingPeriod(may1Edge, null, 1, sep7)?.label, '2026-05');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nall good');
