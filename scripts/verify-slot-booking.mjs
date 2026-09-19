// Verifies the bulk slot-booking methodology against src/lib/slot-planner.ts.
// Pure math only (no DB) — run with:  npm run verify:slot-booking
// Kept as a script rather than a test-runner suite because this repo has no test
// runner configured; it exits non-zero on failure so CI can call it directly.
//
// The rules under test are the selling policy, not an implementation detail:
//   - book what fits, report the gaps; never overwrite a sale
//   - a play is `span` consecutive positions that land together or not at all
//   - re-running a request books nothing new (idempotent)
//   - manually chosen positions are never silently moved

import { planBulkBookings, positionOverlapError } from '../src/lib/slot-planner.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

// 2026-08-10 is a Monday (bit 0), 2026-08-16 the Sunday that closes that week.
const MON = '2026-08-10', TUE = '2026-08-11', SUN = '2026-08-16';
const ALL_DAYS = 127, MON_FRI = 0b0011111;

const store = (id, loopSlotCount = 6, openDays = ALL_DAYS) =>
  ({ id, storeName: `Store ${id}`, loopSlotCount, openDays });
const row = (storeId, date, slotPosition, campaignId, spanId = null) =>
  ({ storeId, date, slotPosition, campaignId, spanId });

// Deterministic span ids so a planned multi-slot play is readable in a diff.
const ids = () => { let n = 0; return () => `span${++n}`; };

const plan = (mode, { stores = [store('S1')], dates = [MON], existing = [] } = {}) =>
  planBulkBookings({ stores, dates, existing, mode, newSpanId: ids() });

// "store|date|first-last|campaign" — the shape an operator would recognise.
const shape = (r) => r.plays.map((p) =>
  `${p.storeId}|${p.date}|${p.positions[0]}${p.positions.length > 1 ? `-${p.positions[p.positions.length - 1]}` : ''}|${p.campaignId}`);
const counts = (r) => ({
  requested: r.requested, booked: r.plays.length,
  already: r.alreadySatisfied, missed: r.gaps.reduce((n, g) => n + g.missed, 0),
  closed: r.closedSkipped,
});

const auto   = (campaignId, span, slotsPerDay) => ({ kind: 'auto', campaignId, span, slotsPerDay });
const manual = (campaignId, span, positions)   => ({ kind: 'manual', campaignId, span, positions });

console.log('auto allocation — lowest free run wins');

eq('empty loop, 1 play → position 0',
  shape(plan(auto('A', 1, 1))), ['S1|2026-08-10|0|A']);

eq('3 plays of a 10s ad → the three lowest positions',
  shape(plan(auto('A', 1, 3))), ['S1|2026-08-10|0|A', 'S1|2026-08-10|1|A', 'S1|2026-08-10|2|A']);

// A 30s ad is 3 consecutive slots per PLAY: 2 plays take 6 rows, not 2.
eq('30s ad, 2 plays → two runs of three',
  shape(plan(auto('A', 3, 2))), ['S1|2026-08-10|0-2|A', 'S1|2026-08-10|3-5|A']);

eq('a sold position is stepped over, never overwritten',
  shape(plan(auto('A', 1, 2), { existing: [row('S1', MON, 0, 'SOLD')] })),
  ['S1|2026-08-10|1|A', 'S1|2026-08-10|2|A']);

// The run must be WHOLLY free: one taken slot at 1 rules out runs headed at 0 and 1.
eq('30s ad skips to the first run with room',
  shape(plan(auto('A', 3, 1), { existing: [row('S1', MON, 1, 'SOLD')] })),
  ['S1|2026-08-10|2-4|A']);

// Positions 2 and 4 sold leaves 0,1,3,5 free — plenty of slots, but no three in a
// row. A 30s ad cannot be squeezed into a fragmented loop, and says so.
eq('free slots but no run long enough → nothing booked, reported as a gap',
  counts(plan(auto('A', 3, 1), { existing: [row('S1', MON, 2, 'SOLD'), row('S1', MON, 4, 'SOLD')] })),
  { requested: 1, booked: 0, already: 0, missed: 1, closed: 0 });

console.log('auto allocation — idempotency and partial fills');

eq('re-running a satisfied request books nothing again',
  counts(plan(auto('A', 1, 2), { existing: [row('S1', MON, 0, 'A'), row('S1', MON, 1, 'A')] })),
  { requested: 2, booked: 0, already: 2, missed: 0, closed: 0 });

eq('a campaign already half-placed books only the shortfall',
  shape(plan(auto('A', 1, 3), { existing: [row('S1', MON, 0, 'A')] })),
  ['S1|2026-08-10|1|A', 'S1|2026-08-10|2|A']);

// One span group is ONE play toward the target, not three.
eq('an existing 30s play counts once, not per row',
  counts(plan(auto('A', 3, 2), {
    existing: [row('S1', MON, 0, 'A', 'g1'), row('S1', MON, 1, 'A', 'g1'), row('S1', MON, 2, 'A', 'g1')],
  })),
  { requested: 2, booked: 1, already: 1, missed: 0, closed: 0 });

eq('more asked than the loop holds → partial, with the remainder as a gap',
  counts(plan(auto('A', 1, 10))),
  { requested: 10, booked: 6, already: 0, missed: 4, closed: 0 });

eq('gap on a day where nothing landed reads "full"',
  plan(auto('A', 1, 1), { existing: [0,1,2,3,4,5].map((p) => row('S1', MON, p, 'SOLD')) }).gaps,
  [{ storeId: 'S1', storeName: 'Store S1', date: MON, missed: 1, reason: 'full' }]);

eq('gap on a day where some landed reads "partial"',
  plan(auto('A', 1, 3), { existing: [0,1,2,3].map((p) => row('S1', MON, p, 'SOLD')) }).gaps,
  [{ storeId: 'S1', storeName: 'Store S1', date: MON, missed: 1, reason: 'partial' }]);

console.log('manual allocation — the operator’s picks are honoured exactly');

eq('named positions are used verbatim',
  shape(plan(manual('A', 1, [2, 5]))), ['S1|2026-08-10|2|A', 'S1|2026-08-10|5|A']);

eq('a named head carries its whole run (30s at 3 → 3,4,5)',
  shape(plan(manual('A', 3, [3]))), ['S1|2026-08-10|3-5|A']);

// The rule that separates manual from auto: a taken pick is a GAP, never a move.
eq('a taken pick is missed, not relocated',
  counts(plan(manual('A', 1, [2]), { existing: [row('S1', MON, 2, 'SOLD')] })),
  { requested: 1, booked: 0, already: 0, missed: 1, closed: 0 });

eq('one pick free, one taken → books the free one only',
  shape(plan(manual('A', 1, [2, 4]), { existing: [row('S1', MON, 2, 'SOLD')] })),
  ['S1|2026-08-10|4|A']);

eq('a run that would overrun the loop is missed',
  counts(plan(manual('A', 3, [4]))),
  { requested: 1, booked: 0, already: 0, missed: 1, closed: 0 });

eq('the same campaign already on a named position is satisfied, not rebooked',
  counts(plan(manual('A', 1, [2]), { existing: [row('S1', MON, 2, 'A')] })),
  { requested: 1, booked: 0, already: 1, missed: 0, closed: 0 });

eq('a whole existing 30s group on the named run is satisfied',
  counts(plan(manual('A', 3, [0]), {
    existing: [row('S1', MON, 0, 'A', 'g1'), row('S1', MON, 1, 'A', 'g1'), row('S1', MON, 2, 'A', 'g1')],
  })),
  { requested: 1, booked: 0, already: 1, missed: 0, closed: 0 });

// Three loose 10s rows of the same brand are not the 30s window that was sold.
eq('scattered same-campaign singles are NOT a 30s play — reported missed',
  counts(plan(manual('A', 3, [0]), {
    existing: [row('S1', MON, 0, 'A'), row('S1', MON, 1, 'A'), row('S1', MON, 2, 'A')],
  })),
  { requested: 1, booked: 0, already: 0, missed: 1, closed: 0 });

console.log('overlapping picks are refused before anything is booked');

eq('30s ad picked at 4 and 5 overlaps',
  positionOverlapError([4, 5], 3),
  'This campaign occupies 3 consecutive slots per play, so chosen positions must be at least 3 apart — 5 and 6 overlap');
eq('30s ad picked at 4 and 7 is legal', positionOverlapError([4, 7], 3), null);
eq('10s ads may sit side by side',      positionOverlapError([4, 5], 1), null);
eq('a single pick can never overlap',   positionOverlapError([4], 3), null);

console.log('copy-day — placements move as whole windows');

const units = [
  { positions: [0], campaignId: 'A', span: 1 },
  { positions: [2, 3, 4], campaignId: 'B', span: 3 },
];
const copy = (over = {}) => ({ kind: 'copy-day', units, sourceStoreId: 'S1', sourceDate: MON, ...over });

eq('a source day replicates onto the next day',
  shape(plan(copy(), { dates: [TUE] })),
  ['S1|2026-08-11|0|A', 'S1|2026-08-11|2-4|B']);

eq('the source store-day is skipped, not copied onto itself',
  shape(plan(copy(), { dates: [MON, TUE] })),
  ['S1|2026-08-11|0|A', 'S1|2026-08-11|2-4|B']);

eq('the same day on a DIFFERENT store is a valid target',
  shape(plan(copy(), { stores: [store('S2')], dates: [MON] })),
  ['S2|2026-08-10|0|A', 'S2|2026-08-10|2-4|B']);

// One occupied slot inside the window blocks the whole window — never a part of it.
eq('a partly-occupied window copies as nothing',
  counts(plan(copy(), { dates: [TUE], existing: [row('S1', TUE, 3, 'SOLD')] })),
  { requested: 2, booked: 1, already: 0, missed: 1, closed: 0 });

eq('a window that does not fit the target loop is missed',
  counts(plan(copy(), { stores: [store('S2', 4)], dates: [MON] })),
  { requested: 2, booked: 1, already: 0, missed: 1, closed: 0 });

eq('a window already holding the same campaign is satisfied',
  counts(plan(copy(), { dates: [TUE], existing: [
    row('S1', TUE, 0, 'A'),
    row('S1', TUE, 2, 'B', 'g1'), row('S1', TUE, 3, 'B', 'g1'), row('S1', TUE, 4, 'B', 'g1'),
  ] })),
  { requested: 2, booked: 0, already: 2, missed: 0, closed: 0 });

console.log('closed days and multi-store spread');

eq('a closed day is skipped without a gap',
  counts(plan(auto('A', 1, 1), { stores: [store('S1', 6, MON_FRI)], dates: [MON, SUN] })),
  { requested: 1, booked: 1, already: 0, missed: 0, closed: 1 });

eq('every day closed → nothing requested at all',
  counts(plan(auto('A', 1, 2), { stores: [store('S1', 6, MON_FRI)], dates: [SUN] })),
  { requested: 0, booked: 0, already: 0, missed: 0, closed: 1 });

eq('two stores over two days each get their own allocation',
  shape(plan(auto('A', 1, 1), { stores: [store('S1'), store('S2')], dates: [MON, TUE] })),
  ['S1|2026-08-10|0|A', 'S1|2026-08-11|0|A', 'S2|2026-08-10|0|A', 'S2|2026-08-11|0|A']);

eq('a store with a smaller loop reports its own shortfall',
  plan(auto('A', 1, 3), { stores: [store('S1', 6), store('S2', 2)] }).gaps,
  [{ storeId: 'S2', storeName: 'Store S2', date: MON, missed: 1, reason: 'partial' }]);

console.log('one request never books the same position twice');

const twice = plan(auto('A', 1, 6));
const keys = twice.plays.map((p) => `${p.storeId}|${p.date}|${p.positions.join(',')}`);
eq('six plays land on six distinct positions', new Set(keys).size, 6);

const grouped = plan(auto('A', 3, 2));
eq('each multi-slot play gets its own span id',
  grouped.plays.map((p) => p.spanId), ['span1', 'span2']);
eq('single-slot plays carry no span id',
  plan(auto('A', 1, 1)).plays.map((p) => p.spanId), [null]);

console.log(failures === 0 ? '\nAll slot-booking checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
