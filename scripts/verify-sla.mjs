// Verifies the Minimum Play Guarantee math in src/lib/sla.ts.
// Run: npm run verify:sla  (exits non-zero on failure)
//
// The two rules that must hold under all inputs: shortfall is never negative, and a
// shortfall never gets BOTH a makegood and a credit — pinned explicitly below.

import {
  cycleBounds, computeShortfall, decideRemedy, proRatedCredit, evaluateCycle,
  remainingMakegoodWeight, MAX_MAKEGOOD_WEIGHT,
} from '../src/lib/sla.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('cycleBounds');
eq('cycle 0 starts at the campaign start date',
  cycleBounds(new Date('2026-01-15T10:00:00Z'), 0),
  { cycleStart: new Date('2026-01-15T00:00:00.000Z'), cycleEnd: new Date('2026-02-15T00:00:00.000Z') });
eq('cycle 2 is two months later',
  cycleBounds(new Date('2026-01-15T10:00:00Z'), 2),
  { cycleStart: new Date('2026-03-15T00:00:00.000Z'), cycleEnd: new Date('2026-04-15T00:00:00.000Z') });

console.log('computeShortfall');
eq('under-delivered', computeShortfall(100, 60), 40);
eq('met exactly', computeShortfall(100, 100), 0);
eq('over-delivered never negative', computeShortfall(100, 150), 0);

console.log('decideRemedy — no dual remedy');
eq('makegood when a next cycle exists', decideRemedy({ hasNextCycle: true }), 'makegood');
eq('credit when there is no next cycle', decideRemedy({ hasNextCycle: false }), 'credit');

console.log('proRatedCredit');
eq('half the plays missed = half the cycle price',
  proRatedCredit({ shortfallPlays: 50, promisedPlays: 100, cyclePriceRupees: 2000 }), 1000);
eq('shortfall capped at 100% of price even if it exceeds promised (shouldn\'t happen, but must not go negative-price)',
  proRatedCredit({ shortfallPlays: 999, promisedPlays: 100, cyclePriceRupees: 2000 }), 2000);
eq('zero promised plays → zero credit (no divide-by-zero)',
  proRatedCredit({ shortfallPlays: 0, promisedPlays: 0, cyclePriceRupees: 2000 }), 0);

console.log('evaluateCycle — the no-dual-remedy invariant end to end');
const met = evaluateCycle({
  cycleIndex: 0, cycleStart: new Date('2026-01-01'), cycleEnd: new Date('2026-02-01'),
  promisedPlays: 100, deliveredPlays: 100, hasNextCycle: true, cyclePriceRupees: 2000,
});
eq('no shortfall → no remedy, both amounts zero', { remedyType: met.remedyType, makegoodBalance: met.makegoodBalance, creditAmount: met.creditAmount },
  { remedyType: null, makegoodBalance: 0, creditAmount: 0 });

const shortMakegood = evaluateCycle({
  cycleIndex: 0, cycleStart: new Date('2026-01-01'), cycleEnd: new Date('2026-02-01'),
  promisedPlays: 100, deliveredPlays: 70, hasNextCycle: true, cyclePriceRupees: 2000,
});
eq('makegood cycle: balance set, credit stays zero',
  { remedyType: shortMakegood.remedyType, makegoodBalance: shortMakegood.makegoodBalance, creditAmount: shortMakegood.creditAmount },
  { remedyType: 'makegood', makegoodBalance: 30, creditAmount: 0 });

const shortCredit = evaluateCycle({
  cycleIndex: 2, cycleStart: new Date('2026-03-01'), cycleEnd: new Date('2026-04-01'),
  promisedPlays: 100, deliveredPlays: 70, hasNextCycle: false, cyclePriceRupees: 2000,
});
eq('final-cycle credit: credit set, makegood balance stays zero',
  { remedyType: shortCredit.remedyType, makegoodBalance: shortCredit.makegoodBalance, creditAmount: shortCredit.creditAmount },
  { remedyType: 'credit', makegoodBalance: 0, creditAmount: 600 });

console.log('remainingMakegoodWeight');
eq('full balance, nothing delivered yet', remainingMakegoodWeight(10, 0), MAX_MAKEGOOD_WEIGHT);
eq('balance paid down below the cap', remainingMakegoodWeight(2, 1), 1);
eq('fully paid down → zero', remainingMakegoodWeight(2, 2), 0);
eq('over-delivered never negative', remainingMakegoodWeight(2, 5), 0);
eq('capped even with a huge balance', remainingMakegoodWeight(1000, 0), MAX_MAKEGOOD_WEIGHT);

console.log(failures === 0 ? '\nAll SLA rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
