// Verifies src/lib/store-signup-links.ts (gated per-tier signup links) and the
// tier-aware Remuneration clause in shared/agreement-terms.ts.
// Run: npm run verify:tier-links  (exits non-zero on failure)

process.env.STORE_SIGNUP_KEY_STANDARD = 'std-secret';
process.env.STORE_SIGNUP_KEY_GROWTH   = 'grw-secret';
process.env.STORE_SIGNUP_KEY_FLAGSHIP = 'flg-secret';

const { tierForSignupKey, isConfiguredTierKey } = await import('../src/lib/store-signup-links.ts');
const { TIER_MONTHLY_MINIMUM_RUPEES } = await import('../shared/agreement-terms.ts');
const { agreementTermsForTier } = await import('../shared/agreement-terms.ts');
const { STORE_PAYOUT_BASE_PAISE } = await import('../src/lib/slot-pricing.ts');

let f=0;
const eq=(n,a,e)=>{ if(JSON.stringify(a)===JSON.stringify(e)) console.log('  ok  ',n); else {f++;console.error('  FAIL',n,'\n    expected',JSON.stringify(e),'\n    actual  ',JSON.stringify(a));} };

eq('standard key -> standard', tierForSignupKey('std-secret'), 'standard');
eq('growth key -> growth',     tierForSignupKey('grw-secret'), 'growth');
eq('flagship key -> flagship', tierForSignupKey('flg-secret'), 'flagship');
eq('no key -> standard',       tierForSignupKey(null), 'standard');
eq('empty key -> standard',    tierForSignupKey(''), 'standard');
eq('unknown key -> standard',  tierForSignupKey('nope'), 'standard');

eq('configured: real key',  isConfiguredTierKey('grw-secret'), true);
eq('configured: bad key',   isConfiguredTierKey('nope'), false);
eq('configured: null',      isConfiguredTierKey(null), false);

eq('minimums', TIER_MONTHLY_MINIMUM_RUPEES, { standard:500, growth:1000, flagship:1500 });

// The clause a partner signs and the base the payout engine actually pays are two
// separate tables (one in rupees, one in paise, and shared/ can't import src/lib/).
// They must state the same number — a partner underpaid against their own contract
// is the failure this guards.
eq('agreement minimums match the payout base', TIER_MONTHLY_MINIMUM_RUPEES,
   Object.fromEntries(Object.entries(STORE_PAYOUT_BASE_PAISE).map(([t, p]) => [t, p / 100])));

const rem = (t) => agreementTermsForTier(t).find(x=>x.heading==='Remuneration').body;
eq('standard clause states 500', rem('standard').includes('₹500'), true);
eq('growth clause states 1,000', rem('growth').includes('₹1,000'), true);
eq('flagship clause states 1,500', rem('flagship').includes('₹1,500'), true);
for (const t of ['standard','growth','flagship']) {
  eq(`${t} clause discloses no percentage`, /%|per cent|percent/.test(rem(t)), false);
  eq(`${t} clause references the target schedule`, rem(t).includes('target schedule'), true);
}
// Every tier's clause must state all three components a partner is actually paid.
// The old copy named only the base, which understated the payout and went stale
// whenever a store changed tier.
for (const t of ['standard','growth','flagship']) {
  eq(`${t} clause states a base rent`,   /base monthly rent/i.test(rem(t)), true);
  eq(`${t} clause covers electricity`,   /electricity/i.test(rem(t)),       true);
  eq(`${t} clause covers the bonus`,     /performance bonus/i.test(rem(t)), true);
}

// The referral reward and the generator/UPS compensation were removed from the
// agreement. Assert they stay gone: nothing in the payout engine ever credited
// either one, and re-adding the clause would recreate the unbacked promise that
// PR #215 had to delete from both onboarding surfaces.
const headings = agreementTermsForTier('flagship').map(x=>x.heading);
eq('no referral clause',  headings.includes('Referral reward'), false);
eq('no generator clause', headings.includes('Generator / UPS'), false);

console.log(f===0 ? '\nAll tier signup-link rules verified.' : `\n${f} failure(s).`);
process.exit(f===0?0:1);
