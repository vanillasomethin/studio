// Verifies the slot pricing/payout math in src/lib/slot-pricing.ts.
// Run: npm run verify:slot-pricing  (exits non-zero on failure)

import {
  isSlotTier, slotBookingPriceRupees, storeSlotPayoutPaise,
  SLOT_TIER_RATE_RUPEES, STORE_PAYOUT_FLOOR_PAISE,
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

console.log('storeSlotPayoutPaise — floor only at zero, 10% formula from the first filled slot');
eq('zero filled -> standard floor', storeSlotPayoutPaise('standard', 0), STORE_PAYOUT_FLOOR_PAISE.standard);
eq('zero filled -> growth floor', storeSlotPayoutPaise('growth', 0), STORE_PAYOUT_FLOOR_PAISE.growth);
eq('zero filled -> flagship floor', storeSlotPayoutPaise('flagship', 0), STORE_PAYOUT_FLOOR_PAISE.flagship);
// 1 filled at standard: 10% of ₹1,000 = ₹100 = 10,000 paise — well under the ₹650 floor,
// but the floor does NOT apply once anything is filled (per spec).
eq('1 filled, standard: no floor blend, pure 10%', storeSlotPayoutPaise('standard', 1), 10_000);
eq('5 filled, standard: ₹500 (matches the reference table)', storeSlotPayoutPaise('standard', 5), 50_000);
eq('10 filled, standard: ₹1,000', storeSlotPayoutPaise('standard', 10), 100_000);
eq('30 filled, standard: ₹3,000', storeSlotPayoutPaise('standard', 30), 300_000);
eq('5 filled, growth: ₹1,000', storeSlotPayoutPaise('growth', 5), 100_000);
eq('30 filled, flagship: ₹9,000', storeSlotPayoutPaise('flagship', 30), 900_000);

console.log(failures === 0 ? '\nAll slot pricing rules verified.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
