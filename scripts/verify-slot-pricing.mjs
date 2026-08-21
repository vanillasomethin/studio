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

console.log('storeSlotPayoutPaise — guaranteed base every month, plus a per-slot incentive');
// The base is unconditional: it is paid irrespective of occupancy and is never
// traded against the incentive, so payout only ever rises as slots fill.
eq('zero filled -> standard base', storeSlotPayoutPaise('standard', 0), STORE_PAYOUT_BASE_PAISE.standard);
eq('zero filled -> growth base', storeSlotPayoutPaise('growth', 0), STORE_PAYOUT_BASE_PAISE.growth);
eq('zero filled -> flagship base', storeSlotPayoutPaise('flagship', 0), STORE_PAYOUT_BASE_PAISE.flagship);
// standard: ₹650 base + ₹100 per filled slot
eq('1 filled, standard: ₹650 + ₹100', storeSlotPayoutPaise('standard', 1), 75_000);
eq('5 filled, standard: ₹650 + ₹500', storeSlotPayoutPaise('standard', 5), 115_000);
eq('10 filled, standard: ₹650 + ₹1,000', storeSlotPayoutPaise('standard', 10), 165_000);
eq('30 filled, standard: ₹650 + ₹3,000', storeSlotPayoutPaise('standard', 30), 365_000);
// growth: ₹1,150 base + ₹200/slot · flagship: ₹1,650 base + ₹300/slot
eq('5 filled, growth: ₹1,150 + ₹1,000', storeSlotPayoutPaise('growth', 5), 215_000);
eq('30 filled, flagship: ₹1,650 + ₹9,000', storeSlotPayoutPaise('flagship', 30), 1_065_000);
eq('per-slot incentive, standard', storeSlotIncentivePaise('standard'), 10_000);
eq('per-slot incentive, growth', storeSlotIncentivePaise('growth'), 20_000);
eq('per-slot incentive, flagship', storeSlotIncentivePaise('flagship'), 30_000);
eq('negative filled clamps to the base', storeSlotPayoutPaise('standard', -3), STORE_PAYOUT_BASE_PAISE.standard);
// never regresses as occupancy grows
eq('payout is monotonic in filled count', (() => {
  for (const t of ['standard','growth','flagship']) {
    for (let n = 1; n <= 30; n++) {
      if (storeSlotPayoutPaise(t, n) <= storeSlotPayoutPaise(t, n - 1)) return `${t}@${n}`;
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

console.log(failures === 0 ? '\nAll slot pricing rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
