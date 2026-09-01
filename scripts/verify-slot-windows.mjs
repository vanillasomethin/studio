// Verifies src/lib/slot-windows.ts (time-window pricing table) and
// src/lib/content-quota.ts (per-tier creative-change quota).
// Run: npm run verify:slot-windows  (exits non-zero on failure)

import {
  SLOT_WINDOWS, getSlotWindow, isWindowId, PEAK_WINDOW_COUNT,
  creditCostForWindow, OFF_PEAK_CREDIT_COST, PEAK_CREDIT_COST,
} from '../src/lib/slot-windows.ts';
import {
  CONTENT_CHANGE_QUOTA, contentChangesRemaining, canChangeContent,
} from '../src/lib/content-quota.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('SLOT_WINDOWS — pinned against the reference pricing table');
eq('8 windows total (7 named + full day)', SLOT_WINDOWS.length, 8);
eq('exactly 4 peak windows', PEAK_WINDOW_COUNT, 4);
eq('peak windows are 1A/2A/3B/3C', SLOT_WINDOWS.filter((w) => w.peak).map((w) => w.id), ['1A', '2A', '3B', '3C']);
eq('1A monthly price', getSlotWindow('1A').costPerMonth, 132.14);
eq('2A monthly price', getSlotWindow('2A').costPerMonth, 147.17);
eq('3B monthly price (highest footfall + highest rate)', getSlotWindow('3B').costPerMonth, 181.50);
eq('3C monthly price', getSlotWindow('3C').costPerMonth, 156.00);
eq('1B (off-peak) monthly price', getSlotWindow('1B').costPerMonth, 75.69);
eq('full day monthly price', getSlotWindow('FULL_DAY').costPerMonth, 750.00);
eq('total minutes = adsPerDay × 20s / 60, for every window', SLOT_WINDOWS.every((w) => w.totalMinutes === Math.round(w.adsPerDay * 20 / 60)), true);

console.log('isWindowId / getSlotWindow');
eq('1A is valid', isWindowId('1A'), true);
eq('FULL_DAY is valid', isWindowId('FULL_DAY'), true);
eq('bogus id is invalid', isWindowId('4Z'), false);
eq('unknown window returns undefined', getSlotWindow('4Z'), undefined);

console.log('creditCostForWindow — peak costs 2, everything else costs 1');
eq('1A (peak) costs 2', creditCostForWindow('1A'), PEAK_CREDIT_COST);
eq('2A (peak) costs 2', creditCostForWindow('2A'), 2);
eq('1B (off-peak) costs 1', creditCostForWindow('1B'), OFF_PEAK_CREDIT_COST);
eq('FULL_DAY costs 1', creditCostForWindow('FULL_DAY'), 1);
eq('unknown window defaults to off-peak cost', creditCostForWindow('bogus'), 1);

console.log('content-quota — Standard 1 / Growth 3 / Flagship unlimited');
eq('quota table', CONTENT_CHANGE_QUOTA, { standard: 1, growth: 3, flagship: null });
eq('standard, 0 used -> 1 remaining, allowed', [contentChangesRemaining('standard', 0), canChangeContent('standard', 0)], [1, true]);
eq('standard, 1 used -> 0 remaining, blocked', [contentChangesRemaining('standard', 1), canChangeContent('standard', 1)], [0, false]);
eq('standard, over-used never goes negative', contentChangesRemaining('standard', 5), 0);
eq('growth, 2 used -> 1 remaining, allowed', [contentChangesRemaining('growth', 2), canChangeContent('growth', 2)], [1, true]);
eq('growth, 3 used -> blocked', canChangeContent('growth', 3), false);
eq('flagship is always unlimited', [contentChangesRemaining('flagship', 999), canChangeContent('flagship', 999)], [null, true]);

console.log(failures === 0 ? '\nAll slot-window / content-quota rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
