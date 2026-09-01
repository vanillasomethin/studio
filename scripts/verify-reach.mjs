// Verifies the Verified Footfall / Estimated Reach split in src/lib/reach.ts.
// Run: npm run verify:reach  (exits non-zero on failure)
//
// The spec's whole point is "don't blend the two into one network-wide number" —
// this pins that a covered store's plays never leak into estimatedReach and vice versa.

import { isSensorCovered, summarizeReach, SENSOR_COVERAGE_WINDOW_MS } from '../src/lib/reach.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('isSensorCovered');
const now = new Date('2026-08-18T12:00:00Z');
eq('null ruviewLastSeen → not covered', isSensorCovered(null, now), false);
eq('undefined ruviewLastSeen → not covered', isSensorCovered(undefined, now), false);
eq('seen 1h ago → covered', isSensorCovered(new Date(now.getTime() - 3_600_000), now), true);
eq('seen exactly at window edge → covered', isSensorCovered(new Date(now.getTime() - SENSOR_COVERAGE_WINDOW_MS), now), true);
eq('seen just past window → not covered', isSensorCovered(new Date(now.getTime() - SENSOR_COVERAGE_WINDOW_MS - 1), now), false);

console.log('summarizeReach');
eq('splits covered vs uncovered without blending',
  summarizeReach({
    storeIds: ['a', 'b', 'c'],
    coveredStoreIds: new Set(['a', 'b']),
    footfallByStore: new Map([['a', 100], ['b', 50]]),
    impressionsByStore: new Map([['a', 999], ['b', 999], ['c', 30]]), // must be ignored for a/b
  }),
  { verifiedFootfall: 150, verifiedStoreCount: 2, estimatedReach: 30, estimatedStoreCount: 1, totalStoreCount: 3 });

eq('covered store with zero footfall data doesn\'t count toward verifiedStoreCount',
  summarizeReach({
    storeIds: ['a'],
    coveredStoreIds: new Set(['a']),
    footfallByStore: new Map(),
    impressionsByStore: new Map(),
  }),
  { verifiedFootfall: 0, verifiedStoreCount: 0, estimatedReach: 0, estimatedStoreCount: 0, totalStoreCount: 1 });

eq('no sensor coverage at all → pure Estimated Reach',
  summarizeReach({
    storeIds: ['x', 'y'],
    coveredStoreIds: new Set(),
    footfallByStore: new Map(),
    impressionsByStore: new Map([['x', 10], ['y', 20]]),
  }),
  { verifiedFootfall: 0, verifiedStoreCount: 0, estimatedReach: 30, estimatedStoreCount: 2, totalStoreCount: 2 });

eq('empty campaign → all zero',
  summarizeReach({ storeIds: [], coveredStoreIds: new Set(), footfallByStore: new Map(), impressionsByStore: new Map() }),
  { verifiedFootfall: 0, verifiedStoreCount: 0, estimatedReach: 0, estimatedStoreCount: 0, totalStoreCount: 0 });

console.log(failures === 0 ? '\nAll reach rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
