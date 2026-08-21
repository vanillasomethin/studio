// Verifies the slot pricing/payout math in src/lib/slot-pricing.ts.
// Run: npm run verify:slot-pricing  (exits non-zero on failure)

import {
  isSlotTier, slotBookingPriceRupees, storeSlotPayoutPaise,
  SLOT_TIER_RATE_RUPEES, STORE_PAYOUT_BASE_PAISE, storeSlotIncentivePaise,
} from '../src/lib/slot-pricing.ts';

let failures = 0;
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

console.log('isSlotTier');
eq('standard is valid', isSlotTier('standard'), true);
eq('growth is valid', isSlotTier('growth'), true);
eq('flagship is valid', isSlotTier('flagship'), true);
eq('premium is not a slot tier', isSlotTier('premium'), false);
eq('null is not a slot tier', isSlotTier(null), false);

console.log('slotBookingPriceRupees — brand billing, flexible position count');
eq('1 position, standard', slotBookingPriceRupees('standard', 1), 1000);
eq('5 positions, standard', slotBookingPriceRupees('standard', 5), 5000);
eq('10 positions, growth', slotBookingPriceRupees('growth', 10), 20000);
eq('30 positions, flagship', slotBookingPriceRupees('flagship', 30), 90000);
eq('any arbitrary count works, not just the reference sizes', slotBookingPriceRupees('standard', 7), 7000);
eq('zero positions costs nothing', slotBookingPriceRupees('flagship', 0), 0);

console.log('storeSlotPayoutPaise — guaranteed tier base, plus the per-slot incentive on top');
// Pinned to the reference incentive table (raw incentive, before the base floor):
//   filled  Standard(₹1,000/slot)  Growth(₹2,000/slot)  Flagship(₹3,000/slot)
//   Base    ₹650                   ₹1,150               ₹1,650
//   5       ₹500                   ₹1,000               ₹1,500
//   10      ₹1,000                 ₹2,000               ₹3,000
//   15      ₹1,500                 ₹3,000               ₹4,500
//   20      ₹2,000                 ₹4,000               ₹6,000
//   30      ₹3,000                 ₹6,000               ₹9,000
// The base is paid every month irrespective of occupancy and the table figure is
// added on top, so Standard at 5 filled is ₹650 + ₹500 = ₹1,150.
const RUPEES = (p) => p / 100;
const INCENTIVE_TABLE = {
  standard: { 5: 500,  10: 1000, 15: 1500, 20: 2000, 30: 3000 },
  growth:   { 5: 1000, 10: 2000, 15: 3000, 20: 4000, 30: 6000 },
  flagship: { 5: 1500, 10: 3000, 15: 4500, 20: 6000, 30: 9000 },
};
const BASE_RUPEES = { standard: 650, growth: 1150, flagship: 1650 };

eq('base row, standard', RUPEES(storeSlotPayoutPaise('standard', 0)), 650);
eq('base row, growth',   RUPEES(storeSlotPayoutPaise('growth',   0)), 1150);
eq('base row, flagship', RUPEES(storeSlotPayoutPaise('flagship', 0)), 1650);

for (const [tier, rows] of Object.entries(INCENTIVE_TABLE)) {
  for (const [filled, incentive] of Object.entries(rows)) {
    const expected = BASE_RUPEES[tier] + incentive;
    eq(`${tier}, ${filled} filled -> ₹${BASE_RUPEES[tier]} base + ₹${incentive} = ₹${expected}`,
       RUPEES(storeSlotPayoutPaise(tier, Number(filled))), expected);
  }
}

eq('per-slot incentive, standard', storeSlotIncentivePaise('standard'), 10_000);
eq('per-slot incentive, growth',   storeSlotIncentivePaise('growth'),   20_000);
eq('per-slot incentive, flagship', storeSlotIncentivePaise('flagship'), 30_000);
eq('negative filled clamps to the base', storeSlotPayoutPaise('standard', -3), STORE_PAYOUT_BASE_PAISE.standard);

// The two properties the earlier "switch at the first filled slot" rule broke.
eq('every filled slot adds its incentive to the base', (() => {
  for (const t of ['standard','growth','flagship']) {
    const step = storeSlotIncentivePaise(t);
    for (let n = 1; n <= 30; n++) {
      if (storeSlotPayoutPaise(t, n) - storeSlotPayoutPaise(t, n - 1) !== step) return `${t}@${n}`;
    }
  }
  return true;
})(), true);
eq('payout never dips below the base', (() => {
  for (const t of ['standard','growth','flagship']) {
    for (let n = 0; n <= 30; n++) {
      if (storeSlotPayoutPaise(t, n) < STORE_PAYOUT_BASE_PAISE[t]) return `${t}@${n}`;
    }
  }
  return true;
})(), true);
eq('payout never falls as occupancy rises', (() => {
  for (const t of ['standard','growth','flagship']) {
    for (let n = 1; n <= 30; n++) {
      if (storeSlotPayoutPaise(t, n) < storeSlotPayoutPaise(t, n - 1)) return `${t}@${n}`;
    }
  }
  return true;
})(), true);

console.log(failures === 0 ? '\nAll slot pricing rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
