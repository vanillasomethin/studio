// Pins the identity that makes the daily-accrual payout safe to ship:
//
//   a store live for a WHOLE month at a constant N filled slots must earn
//   exactly storeSlotPayoutPaise(tier, N) — the figure partners have already
//   been shown by /api/stores/me.
//
// If that identity ever breaks, the new month-integrated formula is silently
// repricing every existing partner. Run: node scripts/verify-store-payout.mjs

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The libs are TypeScript; compile the pure modules to a scratch dir. CommonJS,
// not ESM — tsc emits the source's extension-less relative imports verbatim and
// Node's ESM resolver rejects those, while require() resolves them fine.
const out = mkdtempSync(join(tmpdir(), 'payout-'));
execSync(
  `npx tsc src/lib/store-payout.ts src/lib/slot-pricing.ts src/lib/power.ts ` +
  `--outDir ${out} --module commonjs --target es2022 --moduleResolution node --skipLibCheck`,
  { stdio: 'inherit' },
);
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');

const require = createRequire(import.meta.url);
const { computePayout, monthWindow, liveDayKeys } = require(join(out, 'store-payout.js'));
const { storeSlotPayoutPaise, SLOT_TIERS } = require(join(out, 'slot-pricing.js'));

let failures = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${got}, want ${want}`);
};

const MONTH = '2026-07'; // 31 days
const { days } = monthWindow(MONTH);
check('days in 2026-07', days, 31);

// A store live the whole month, N distinct campaigns booked every single day.
const fullMonth = (n) => {
  const m = new Map();
  for (let d = 1; d <= days; d++) m.set(`2026-07-${String(d).padStart(2, '0')}`, n);
  return m;
};

const base = {
  month: MONTH,
  storeId: 's1',
  loopSlotCount: 30,
  storeTier: 'standard',
  monthlyCompensationPaise: 50_000,
  daysInMonth: days,
  liveDays: days,
  brandsPlayed: 5,
  kwh: 0,
  kwhSource: 'metered',
  usingDefaultWatts: false,
  paisePerKwh: 800,
};

// ── The identity, across every tier and a range of occupancies ──────────────
for (const tier of SLOT_TIERS) {
  for (const n of [0, 1, 5, 12, 30]) {
    const b = computePayout({ ...base, slotPricingTier: tier, filledByDay: fullMonth(n) });
    check(
      `${tier} full month @ ${n} filled → matches storeSlotPayoutPaise`,
      b.basePaise + b.incentivePaise,
      storeSlotPayoutPaise(tier, n),
    );
  }
}

// The spec's headline example.
const standard5 = computePayout({ ...base, slotPricingTier: 'standard', filledByDay: fullMonth(5) });
check('standard, 5 filled all month → 115000 paise', standard5.basePaise + standard5.incentivePaise, 115_000);
check('  …of which base', standard5.basePaise, 65_000);
check('  …of which incentive', standard5.incentivePaise, 50_000);
check('  avgFilledSlots', standard5.avgFilledSlots, 5);

// ── Electricity rides on top ────────────────────────────────────────────────
const withPower = computePayout({
  ...base, slotPricingTier: 'standard', filledByDay: fullMonth(5), kwh: 26.8, paisePerKwh: 800,
});
check('electricity 26.8 kWh @ 800 p/kWh', withPower.electricityPaise, 21_440);
check('total = base + incentive + electricity', withPower.totalPaise, 65_000 + 50_000 + 21_440);

// ── Half a month live → half the base, and only the days lived count ────────
const halfDays = 16; // live from the 16th → 16 days (16th..31st)
const halfMap = new Map();
for (let d = 16; d <= 31; d++) halfMap.set(`2026-07-${d}`, 5);
const half = computePayout({
  ...base, slotPricingTier: 'standard', liveDays: halfDays, filledByDay: halfMap,
});
check('half month base is pro-rated', half.basePaise, Math.round((65_000 * 16) / 31));
check('half month incentive is pro-rated', half.incentivePaise, Math.round((10_000 * 16 * 5) / 31));
check('half month avgFilledSlots still 5', half.avgFilledSlots, 5);

// ── Edge cases ──────────────────────────────────────────────────────────────
const dark = computePayout({ ...base, slotPricingTier: 'standard', filledByDay: new Map(), brandsPlayed: 0 });
check('no bookings → base only (the base is guaranteed)', dark.totalPaise, 65_000);

const notLive = computePayout({ ...base, slotPricingTier: 'standard', liveDays: 0, filledByDay: new Map() });
check('never live → zero', notLive.totalPaise, 0);
check('never live → avgFilledSlots 0 not NaN', notLive.avgFilledSlots, 0);

const flat = computePayout({ ...base, loopSlotCount: null, slotPricingTier: 'standard', filledByDay: fullMonth(5) });
check('playlist-mode store → flat column, no incentive', flat.basePaise, 50_000);
check('playlist-mode store → incentive 0', flat.incentivePaise, 0);

// ── liveDayKeys respects the IST month edges ────────────────────────────────
const NOW = new Date('2026-08-15T00:00:00Z'); // well after July
check('live from 2026-06-01 → all 31 July days',
  liveDayKeys(MONTH, new Date('2026-06-01T00:00:00Z'), NOW).length, 31);
check('live from 2026-07-16 → 16 July days',
  liveDayKeys(MONTH, new Date('2026-07-16T00:00:00Z'), NOW).length, 16);
check('live after the month ended → 0 days',
  liveDayKeys(MONTH, new Date('2026-08-01T00:00:00Z'), NOW).length, 0);
check('no liveAt → 0 days', liveDayKeys(MONTH, null, NOW).length, 0);
// 2026-07-01 00:30 IST is 2026-06-30 19:00 UTC — the off-by-5.5h trap.
check('liveAt just after IST midnight on the 1st → all 31 days',
  liveDayKeys(MONTH, new Date('2026-06-30T19:00:00Z'), NOW).length, 31);
// A month still running is paid only for elapsed days.
check('current month pays elapsed days only',
  liveDayKeys('2026-08', new Date('2026-01-01T00:00:00Z'), new Date('2026-08-15T12:00:00Z')).length, 15);

console.log(failures === 0 ? '\nAll payout checks passed.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
