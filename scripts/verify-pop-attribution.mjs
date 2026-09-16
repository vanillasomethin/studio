// Verifies proof-of-play campaign attribution (attributeSlotPlay in src/lib/slots.ts).
// Pure logic only (no DB) — run with:  npm run verify:pop-attribution
// Kept as a script rather than a test-runner suite because this repo has no test
// runner configured; it exits non-zero on failure so CI can call it directly.
//
// The rule under test: when a player does not echo the plan item's campaignId,
// the server credits the play to whoever held that loop position on that IST
// date. Getting this wrong is silent — plays still record, they just stop being
// billable — so the edge cases below are the whole point.

import { attributeSlotPlay, slotPlayKey } from '../src/lib/slots.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

// Loop of 3 positions sold on 2026-09-16 IST, plus one position the next day.
const booked = new Map([
  [slotPlayKey('2026-09-16', 0), 'camp-a'],
  [slotPlayKey('2026-09-16', 1), 'camp-b'],
  [slotPlayKey('2026-09-16', 7), 'camp-c'],
  [slotPlayKey('2026-09-17', 0), 'camp-d'],
]);

const play = (over) => ({ slotPosition: 0, isFiller: false, startedAt: '2026-09-16T06:00:00.000Z', ...over });

console.log('attributeSlotPlay — derive from the booking that held the slot');
eq('sold position → its campaign', attributeSlotPlay(play({ slotPosition: 1 }), booked), 'camp-b');
eq('non-contiguous position → its campaign', attributeSlotPlay(play({ slotPosition: 7 }), booked), 'camp-c');
eq('unsold position → null', attributeSlotPlay(play({ slotPosition: 5 }), booked), null);
eq('empty booking map → null', attributeSlotPlay(play({}), new Map()), null);

console.log('filler and bonus plays are never derived');
// A bonus play lands in a position booked by SOMEONE ELSE. Deriving there would
// credit camp-b for a play that was really a replay of another campaign's ad —
// inventing proof-of-play for a brand that did not buy that position.
eq('isFiller → null even on a sold position', attributeSlotPlay(play({ slotPosition: 1, isFiller: true }), booked), null);
eq('isFiller on unsold position → null', attributeSlotPlay(play({ slotPosition: 5, isFiller: true }), booked), null);

console.log('schedule-mode and malformed events');
eq('no slotPosition → null', attributeSlotPlay(play({ slotPosition: undefined }), booked), null);
eq('null slotPosition → null', attributeSlotPlay(play({ slotPosition: null }), booked), null);
eq('unparseable startedAt → null', attributeSlotPlay(play({ startedAt: 'not-a-date' }), booked), null);
// isFiller is optional in the wire format; absent must behave as "guaranteed",
// matching the route's `isFiller: ev.isFiller === true` storage rule.
eq('omitted isFiller → treated as guaranteed', attributeSlotPlay({ slotPosition: 0, startedAt: '2026-09-16T06:00:00.000Z' }, booked), 'camp-a');

console.log('IST date boundaries — the loop is a per-IST-day thing');
// 18:35 UTC on the 16th is 00:05 IST on the 17th: the play belongs to the 17th's
// loop, so it must pick up camp-d and not the 16th's camp-a. Using UTC dates here
// would misattribute every play in the 18:30–24:00 UTC window.
eq('just after IST midnight → next day\'s booking',
  attributeSlotPlay(play({ startedAt: '2026-09-16T18:35:00.000Z' }), booked), 'camp-d');
eq('just before IST midnight → same day\'s booking',
  attributeSlotPlay(play({ startedAt: '2026-09-16T18:25:00.000Z' }), booked), 'camp-a');
// A store open till 21:00 IST is at 15:30 UTC — same IST day, no rollover.
eq('IST evening stays on its own day',
  attributeSlotPlay(play({ startedAt: '2026-09-16T15:29:00.000Z' }), booked), 'camp-a');
// Date objects are accepted as well as ISO strings (the route passes strings,
// a backfill would likely pass Dates).
eq('Date instance works like an ISO string',
  attributeSlotPlay(play({ startedAt: new Date('2026-09-16T06:00:00.000Z') }), booked), 'camp-a');

if (failures) {
  console.error(`\n${failures} attribution rule(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll proof-of-play attribution rules verified.');
