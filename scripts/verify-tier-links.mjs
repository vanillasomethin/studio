// Verifies src/lib/store-signup-links.ts (gated per-tier signup links) and the
// tier-aware Remuneration clause in shared/agreement-terms.ts.
// Run: npm run verify:tier-links  (exits non-zero on failure)

process.env.STORE_SIGNUP_KEY_STANDARD = 'std-secret';
process.env.STORE_SIGNUP_KEY_GROWTH   = 'grw-secret';
process.env.STORE_SIGNUP_KEY_FLAGSHIP = 'flg-secret';

const { tierForSignupKey, isConfiguredTierKey } = await import('../src/lib/store-signup-links.ts');
const { TIER_MONTHLY_MINIMUM_RUPEES } = await import('../shared/agreement-terms.ts');
const { agreementTermsForTier } = await import('../shared/agreement-terms.ts');

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

eq('minimums', TIER_MONTHLY_MINIMUM_RUPEES, { standard:650, growth:1150, flagship:1650 });

const rem = (t) => agreementTermsForTier(t).find(x=>x.heading==='Remuneration').body;
eq('standard clause states 650', rem('standard').includes('₹650'), true);
eq('growth clause states 1,150', rem('growth').includes('₹1,150'), true);
eq('flagship clause states 1,650', rem('flagship').includes('₹1,650'), true);
for (const t of ['standard','growth','flagship']) {
  eq(`${t} clause discloses no percentage`, /%|per cent|percent/.test(rem(t)), false);
  eq(`${t} clause references the target schedule`, rem(t).includes('target schedule'), true);
}
// other clauses untouched
eq('referral clause unchanged', agreementTermsForTier('flagship').find(x=>x.heading==='Referral reward').body.includes('₹500'), true);

console.log(f===0 ? '\nAll tier signup-link rules verified.' : `\n${f} failure(s).`);
process.exit(f===0?0:1);
