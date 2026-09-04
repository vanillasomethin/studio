#!/usr/bin/env node
// Checks the brand campaign price ladder — volume tiers and the duration
// discount — against a table written from the commercial rules rather than from
// the code, so a change to either lever has to be deliberate.
//
//   node --experimental-strip-types scripts/verify-brand-pricing.mjs
//
// The duration discount matters twice over: the browser shows it and
// /api/razorpay/create-order re-derives the charge from the same module, so an
// error here is an error in what the customer is actually billed.

import {
  getScreenPrice, campaignListBase, campaignBase,
  durationDiscountRate, durationDiscountRupees, campaignTotal, gstOn,
} from '../src/lib/brand-pricing.ts';

let failures = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(52)} got ${String(got).padStart(9)}  want ${String(want).padStart(9)}`);
};

console.log('\nPer-screen monthly price by volume');
check('1 screen',   getScreenPrice(1),  999);
check('3 screens',  getScreenPrice(3),  899);
check('10 screens', getScreenPrice(10), 799);
check('20 screens', getScreenPrice(20), 699);
check('50 screens', getScreenPrice(50), 699);

console.log('\nDuration discount rate');
check('1 month  → none',  durationDiscountRate(1),  0);
check('2 months → none',  durationDiscountRate(2),  0);
check('3 months → 2.5%',  durationDiscountRate(3),  0.025);
check('5 months → 2.5%',  durationDiscountRate(5),  0.025);
check('6 months → 5%',    durationDiscountRate(6),  0.05);
check('12 months → 5%',   durationDiscountRate(12), 0.05);

console.log('\nBase before and after the duration discount');
// 1 screen @ ₹999
check('1 screen × 1 month, list',      campaignListBase(1, 1),  999);
check('1 screen × 1 month, charged',   campaignBase(1, 1),      999);
check('1 screen × 3 months, list',     campaignListBase(1, 3),  2997);
check('1 screen × 3 months, −2.5%',    campaignBase(1, 3),      2997 - Math.round(2997 * 0.025));
check('1 screen × 6 months, list',     campaignListBase(1, 6),  5994);
check('1 screen × 6 months, −5%',      campaignBase(1, 6),      5994 - Math.round(5994 * 0.05));
// Both levers at once: 10 screens earns the volume tier AND the duration cut.
check('10 screens × 6 months, list',   campaignListBase(10, 6), 799 * 10 * 6);
check('10 screens × 6 months, −5%',    campaignBase(10, 6),     47940 - Math.round(47940 * 0.05));
check('duration cut, 10 × 6 months',   durationDiscountRupees(10, 6), Math.round(47940 * 0.05));

console.log('\nFinal charge');
const net6 = campaignBase(10, 6);
check('10 × 6 months incl. GST',       campaignTotal({ screens: 10, months: 6, applyGst: true }), net6 + gstOn(net6));
check('coupon stacks on the discount', campaignTotal({ screens: 10, months: 6, discount: 100, applyGst: false }), net6 - 100);
check('discount cannot go negative',   campaignTotal({ screens: 1, months: 1, discount: 99999, applyGst: false }), 0);

console.log(failures === 0 ? '\nAll brand pricing checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
