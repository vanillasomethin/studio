// Verifies the electricity estimation math in src/lib/power.ts.
// Run: npm run verify:power  (exits non-zero on failure)
//
// These numbers are shown to partners as rupees, so the arithmetic is worth pinning:
// a silent factor-of-1000 or an unclamped bucket becomes a wrong figure in someone's
// hand, not just a bad pixel.

import {
  onHoursFromBuckets, estimateKwh, estimateCostPaise, estimatePower, istMonthStart,
} from '../src/lib/power.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

const HOUR = 3_600_000;

console.log('on-hours from proof-of-play buckets');
eq('full hours sum',        onHoursFromBuckets([{ totalMs: HOUR }, { totalMs: HOUR }]), 2);
eq('partial hour',          onHoursFromBuckets([{ totalMs: HOUR / 2 }]), 0.5);
eq('no buckets → zero',     onHoursFromBuckets([]), 0);
// Overlapping/replayed events can push a bucket past wall-clock time; uncapped that
// would inflate the partner's bill.
eq('bucket capped at 1h',   onHoursFromBuckets([{ totalMs: HOUR * 5 }]), 1);
eq('negative ignored',      onHoursFromBuckets([{ totalMs: -HOUR }]), 0);

console.log('energy + cost');
// 60 W for 12 h = 0.72 kWh. This is the shape of one store-day.
eq('60W × 12h = 0.72 kWh',  estimateKwh(60, 12), 0.72);
eq('zero hours → 0 kWh',    estimateKwh(60, 0), 0);
eq('zero watts → 0 kWh',    estimateKwh(0, 12), 0);
// 0.72 kWh at ₹8.00/unit = ₹5.76 = 576 paise.
eq('0.72 kWh @ ₹8 = 576p',  estimateCostPaise(0.72, 800), 576);
eq('rounds to whole paise', estimateCostPaise(0.7234, 800), 579);
eq('zero kwh → 0 paise',    estimateCostPaise(0, 800), 0);

console.log('estimatePower — store wattage vs fleet default');
const month = Array.from({ length: 30 }, () => ({ totalMs: 12 * HOUR / 12 })); // 30 × 1h = 30h
eq('uses the store’s own wattage when surveyed',
  estimatePower({ buckets: month, storeWatts: 90, defaultWatts: 60, paisePerKwh: 800 }),
  { onHours: 30, kwh: 2.7, costPaise: 2160, watts: 90, paisePerKwh: 800, usingDefaultWatts: false });

eq('falls back to the fleet default and flags it',
  estimatePower({ buckets: month, storeWatts: null, defaultWatts: 60, paisePerKwh: 800 }),
  { onHours: 30, kwh: 1.8, costPaise: 1440, watts: 60, paisePerKwh: 800, usingDefaultWatts: true });

// The point of the SOP: an unsurveyed store's figure can be off by ~2×.
const surveyed = estimatePower({ buckets: month, storeWatts: 120, defaultWatts: 60, paisePerKwh: 800 });
const guessed  = estimatePower({ buckets: month, storeWatts: null, defaultWatts: 60, paisePerKwh: 800 });
eq('default vs real 120W screen understates by half', guessed.costPaise * 2, surveyed.costPaise);

eq('a screen that never ran costs nothing',
  estimatePower({ buckets: [], storeWatts: 60, defaultWatts: 60, paisePerKwh: 800 }).costPaise, 0);

console.log('IST month start');
// 2026-08-13 06:00 IST is 2026-08-13 00:30 UTC — the month must start at IST midnight,
// which is 18:30 UTC on the last day of the previous month.
eq('month start is IST midnight',
  istMonthStart(new Date('2026-08-13T00:30:00Z')).toISOString(), '2026-07-31T18:30:00.000Z');
eq('start-of-month instant is stable',
  istMonthStart(new Date('2026-08-01T00:00:00+05:30')).toISOString(), '2026-07-31T18:30:00.000Z');

console.log(failures === 0 ? '\nAll power rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
