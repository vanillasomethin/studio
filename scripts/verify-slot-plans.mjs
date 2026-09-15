// Verifies standing assignments (SlotPlan) against src/lib/slots.ts.
// Pure math only (no DB) — run with:  npx tsx scripts/verify-slot-plans.mjs
// Kept as a script rather than a test-runner suite because this repo has no test
// runner configured; it exits non-zero on failure so CI can call it directly.
//
// The invariant that matters most: a plan NEVER takes a sold position. Everything
// about the model — availability staying `loopSlotCount − sold bookings`, SLA and
// add-ons being untouched — rests on that, so it is asserted from several angles.

import { buildSlotLoop } from '../src/lib/slots.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

const booking = (pos, id, content = `${id}-creative`) =>
  ({ slotPosition: pos, campaignId: id, creativeIds: [content] });
const plan = (id, slotsPerDay, content = `${id}-creative`) =>
  ({ campaignId: id, creativeIds: [content], slotsPerDay });
const FILLER = { campaignId: 'house', creativeIds: ['house-creative'] };
// position:campaign:source
const shape = (loop) => loop.map((a) => `${a.slotPosition}:${a.campaignId}:${a.source}`);
const sources = (loop) => loop.map((a) => a.source);

console.log('buildSlotLoop — standing assignments (SlotPlan)');

// Fill order is sold → plan → bonus → filler.
eq('plan takes the free positions, sold keeps its own',
  shape(buildSlotLoop(4, [booking(0, 'A')], FILLER, 0, new Map(), [plan('P', 2)])),
  ['0:A:sold', '1:P:plan', '2:P:plan', '3:A:bonus']);

eq('plan outranks the bonus round-robin',
  sources(buildSlotLoop(3, [booking(0, 'A')], FILLER, 0, new Map(), [plan('P', 1)])),
  ['sold', 'plan', 'bonus']);

eq('plan outranks house filler when nothing is sold',
  shape(buildSlotLoop(3, [], FILLER, 0, new Map(), [plan('P', 2)])),
  ['0:P:plan', '1:P:plan', '2:house:filler']);

// The load-bearing invariant.
eq('a fully sold loop yields the plan nothing',
  shape(buildSlotLoop(2, [booking(0, 'A'), booking(1, 'B')], FILLER, 0, new Map(), [plan('P', 5)])),
  ['0:A:sold', '1:B:sold']);

eq('plan quota is capped by its slotsPerDay, remainder goes to bonus',
  sources(buildSlotLoop(5, [booking(0, 'A')], FILLER, 0, new Map(), [plan('P', 1)])),
  ['sold', 'plan', 'bonus', 'bonus', 'bonus']);

// Two plans take turns, so one greedy plan cannot eat the whole tail.
eq('multiple plans interleave rather than draining in order',
  shape(buildSlotLoop(5, [], null, 0, new Map(), [plan('P', 2), plan('Q', 2)])),
  ['0:P:plan', '1:Q:plan', '2:P:plan', '3:Q:plan']);

eq('an exhausted plan yields to the one with quota left',
  shape(buildSlotLoop(4, [], null, 0, new Map(), [plan('P', 1), plan('Q', 3)])),
  ['0:P:plan', '1:Q:plan', '2:Q:plan', '3:Q:plan']);

// A plan is not guaranteed inventory — it must never look like a sold play, or it
// would count toward a PlayGuaranteeCycle's delivered total.
eq('plan plays are flagged isFiller (not guaranteed delivery)',
  buildSlotLoop(2, [], null, 0, new Map(), [plan('P', 2)]).map((a) => a.isFiller),
  [true, true]);

eq('plan plays never claim a multi-slot window',
  buildSlotLoop(3, [], null, 0, new Map(), [plan('P', 3)]).map((a) => a.spanSlots),
  [1, 1, 1]);

// Degenerate inputs must not produce phantom plays.
eq('a plan with no creative is ignored',
  shape(buildSlotLoop(2, [], FILLER, 0, new Map(), [{ campaignId: 'P', creativeIds: [], slotsPerDay: 5 }])),
  ['0:house:filler', '1:house:filler']);

eq('a plan asking for zero slots is ignored',
  shape(buildSlotLoop(2, [], FILLER, 0, new Map(), [plan('P', 0)])),
  ['0:house:filler', '1:house:filler']);

eq('no plans is byte-identical to the old behaviour',
  shape(buildSlotLoop(4, [booking(0, 'A')], FILLER, 0, new Map(), [])),
  shape(buildSlotLoop(4, [booking(0, 'A')], FILLER)));

// A plan must not steal positions inside a multi-slot placement's window.
const spanBooking = (pos, spanId) =>
  ({ slotPosition: pos, campaignId: 'S', creativeIds: ['S-creative'], spanId, creativeSpan: 3 });
eq('a 30s window keeps all three of its positions',
  shape(buildSlotLoop(5,
    [spanBooking(0, 'sp1'), spanBooking(1, 'sp1'), spanBooking(2, 'sp1')],
    FILLER, 0, new Map(), [plan('P', 5)])),
  ['0:S:sold', '3:P:plan', '4:P:plan']);

// Creative rotation must advance for plan plays like any other play.
eq('a plan playlist rotates across its positions',
  buildSlotLoop(3, [], null, 0, new Map(),
    [{ campaignId: 'P', creativeIds: ['c1', 'c2'], slotsPerDay: 3 }]).map((a) => a.contentId),
  ['c1', 'c2', 'c1']);

console.log(failures === 0 ? '\nAll slot-plan rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
