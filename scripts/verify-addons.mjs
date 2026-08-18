// Verifies the Peak Boost / Sound Ad math in src/lib/addons.ts.
// Run: npm run verify:addons  (exits non-zero on failure)

import {
  istMinutesOfDay, activePeakWindowId, isPeakWindowNow, decideAddonStatus,
  peakBoostPoolWeights, PEAK_WINDOWS, PEAK_BOOST_CAP, SOUND_AD_CAP, PEAK_BOOST_EXTRA_WEIGHT,
} from '../src/lib/addons.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('istMinutesOfDay');
// 2026-08-18 09:00 IST is 2026-08-18 03:30 UTC.
eq('IST 09:00 → 540 minutes', istMinutesOfDay(new Date('2026-08-18T03:30:00Z')), 9 * 60);
eq('IST midnight → 0', istMinutesOfDay(new Date('2026-08-17T18:30:00Z')), 0);

console.log('activePeakWindowId — the four named windows, and the gaps between them');
eq('9:00 is inside window 1A', activePeakWindowId(9 * 60), '1A');
eq('10:59 is inside window 1A', activePeakWindowId(10 * 60 + 59), '1A');
eq('11:00 is NOT inside window 1A (half-open)', activePeakWindowId(11 * 60), null);
eq('12:30 is inside window 2A', activePeakWindowId(12 * 60 + 30), '2A');
eq('12:00 is in the gap between 1A and 2A', activePeakWindowId(12 * 60), null);
eq('17:30 is inside window 3B', activePeakWindowId(17 * 60 + 30), '3B');
eq('19:30 is inside window 3C', activePeakWindowId(19 * 60 + 30), '3C');
eq('21:30 is after every window', activePeakWindowId(21 * 60 + 30), null);
eq('every window is accounted for', PEAK_WINDOWS.map((w) => w.id), ['1A', '2A', '3B', '3C']);

console.log('isPeakWindowNow');
eq('9am IST is a peak window', isPeakWindowNow(new Date('2026-08-18T03:30:00Z')), true);
eq('3pm IST is not', isPeakWindowNow(new Date('2026-08-18T09:30:00Z')), false);

console.log('decideAddonStatus — first-come-first-served against the cap');
eq('under the Peak Boost cap → active', decideAddonStatus(PEAK_BOOST_CAP - 1, 'peak_boost'), 'active');
eq('at the Peak Boost cap → waitlisted', decideAddonStatus(PEAK_BOOST_CAP, 'peak_boost'), 'waitlisted');
eq('Sound Ad cap is 1, not per brand', SOUND_AD_CAP, 1);
eq('first Sound Ad purchase → active', decideAddonStatus(0, 'sound_ad'), 'active');
eq('second Sound Ad purchase → waitlisted', decideAddonStatus(1, 'sound_ad'), 'waitlisted');

console.log('peakBoostPoolWeights — no boost outside a peak window, no dual remedy needed here since these are additive by design');
eq('outside a peak window → empty map regardless of who is boosted',
  [...peakBoostPoolWeights(['A', 'B'], false).entries()], []);
eq('inside a peak window → every boosted campaign gets the extra weight',
  [...peakBoostPoolWeights(['A', 'B'], true).entries()], [['A', PEAK_BOOST_EXTRA_WEIGHT], ['B', PEAK_BOOST_EXTRA_WEIGHT]]);
eq('no boosted campaigns → empty map even inside a peak window',
  [...peakBoostPoolWeights([], true).entries()], []);

console.log(failures === 0 ? '\nAll add-on rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
