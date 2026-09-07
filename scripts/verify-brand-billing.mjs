// Pins that the price a brand SEES equals the price create-order CHARGES.
//
// The two are computed in different places — the payment step builds
// base → discount → GST inline, the server calls campaignTotal — so a change to
// either can silently open a gap between the checkout figure and the Razorpay
// order. That gap is the worst class of bug in this flow: it is invisible until
// a customer disputes a charge.
//
// Run: node scripts/verify-brand-billing.mjs

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'billing-'));
execSync(
  `npx tsc src/lib/brand-pricing.ts src/lib/slot-pricing.ts ` +
  `--outDir ${out} --module commonjs --target es2022 --moduleResolution node --skipLibCheck`,
  { stdio: 'inherit' },
);
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');

const require = createRequire(import.meta.url);
const P = require(join(out, 'brand-pricing.js'));

let failures = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${got}, want ${want}`);
};

// ── The rate card ───────────────────────────────────────────────────────────
check('Standard / store / month', P.storeMonthlyPrice('standard'), 1000);
check('Growth   / store / month', P.storeMonthlyPrice('growth'),   2000);
check('Flagship / store / month', P.storeMonthlyPrice('flagship'), 3000);
check('unknown tier falls back to standard', P.storeMonthlyPrice(P.asTier('bogus')), 1000);
check('null tier falls back to standard',    P.storeMonthlyPrice(P.asTier(null)),    1000);

// ── The spec's worked example ───────────────────────────────────────────────
const picked = ['flagship', 'standard', 'standard'];
check('1 Flagship + 2 Standard, 1 month, base', P.campaignBaseForStores(picked, 1), 5000);
check('  …with GST', P.campaignTotal({ screens: 3, months: 1, tiers: picked, applyGst: true }), 5900);
check('20 screens count-only, 1 month, base', P.campaignBaseForCount(20, 1), 20000);
check('20 screens count-only, 3 months, base', P.campaignBaseForCount(20, 3), 60000);

// ── Client display vs server charge ─────────────────────────────────────────
// Mirrors the payment step exactly (page.tsx ~1046-1061): base → discount → GST.
function clientTotal({ screens, months, tiers, coupon }) {
  const base = tiers.length > 0
    ? P.campaignBaseForStores(tiers, months)
    : P.campaignBaseForCount(screens, months);
  const discount = !coupon ? 0 : coupon.type === 'PERCENT'
    ? Math.min(base, Math.round((base * coupon.value) / 100))
    : Math.min(base, coupon.value);
  const subtotal = Math.max(0, base - discount);
  return subtotal + Math.round(subtotal * 0.18);
}
// Mirrors create-order: server resolves the discount, then campaignTotal.
function serverTotal({ screens, months, tiers, coupon }) {
  const base = P.campaignTotal({ screens, months, tiers, applyGst: false });
  const discount = !coupon ? 0 : coupon.type === 'PERCENT'
    ? Math.min(base, Math.round((base * coupon.value) / 100))
    : Math.min(base, coupon.value);
  return P.campaignTotal({ screens, months, tiers, discount, applyGst: true });
}

const CASES = [
  { name: '1 Flagship + 2 Standard, 1 mo, no coupon', screens: 3, months: 1, tiers: picked, coupon: null },
  { name: '20 screens count-only, 3 mo',              screens: 20, months: 3, tiers: [],     coupon: null },
  { name: 'above flagship case + ₹100 FLAT coupon',   screens: 3, months: 1, tiers: picked, coupon: { type: 'FLAT', value: 100 } },
  { name: 'flagship case + 10% PERCENT coupon',       screens: 3, months: 1, tiers: picked, coupon: { type: 'PERCENT', value: 10 } },
  { name: '5 Growth, 6 mo, ₹500 FLAT',                screens: 5, months: 6, tiers: Array(5).fill('growth'), coupon: { type: 'FLAT', value: 500 } },
  { name: '1 Standard, 1 mo',                          screens: 1, months: 1, tiers: ['standard'], coupon: null },
];

for (const c of CASES) {
  const client = clientTotal(c);
  const server = serverTotal(c);
  check(`client == server — ${c.name} (₹${server})`, client, server);
}

// ── The ids win over a mismatched screen count ──────────────────────────────
// create-order sets screens = storeIds.length, so a tampered `screens` cannot
// change the charge when stores were picked.
check('tiers drive the price, not `screens`',
  P.campaignTotal({ screens: 999, months: 1, tiers: picked, applyGst: false }), 5000);
check('no tiers → count is used',
  P.campaignTotal({ screens: 4, months: 1, tiers: [], applyGst: false }), 4000);
check('empty tiers array behaves as count path',
  P.campaignTotal({ screens: 2, months: 2, tiers: [], applyGst: false }), 4000);

// ── Clamps ──────────────────────────────────────────────────────────────────
check('screens clamped to 50 on the count path', P.campaignBaseForCount(9999, 1), 50000);
check('months clamped to 12', P.campaignBaseForCount(1, 9999), 12000);
check('zero/NaN screens floors to 1', P.campaignBaseForCount(0, 1), 1000);

console.log(failures === 0 ? '\nAll billing checks passed.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
