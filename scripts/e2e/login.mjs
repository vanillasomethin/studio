// Signs the seeded admin into the real console — email + password + a live TOTP
// code, through the actual next-auth admin-mfa provider — and saves the browser
// storage state so the other scripts can call admin APIs as a real operator.
//
// Nothing here fakes a session: if the guard, the provider or the AdminSession
// row stops working, this fails, which is the point.

import { chromium } from 'playwright';
import { assertLocalDb, BASE_URL, CHROME, ok, finish } from './guard.mjs';
import { totpNow } from './totp.mjs';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_MFA_SECRET } from './fixtures.mjs';

assertLocalDb();
const STATE = new URL('./state.json', import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx  = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();

const probe = (p) => p.evaluate(async (base) => {
  const r = await fetch(`${base}/api/slots/bookings/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  return r.status;
}, BASE_URL);

await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle', timeout: 60_000 });
ok('bulk booking is 401 before signing in', await probe(page) === 401);

await page.fill('input[type=email]', ADMIN_EMAIL);
await page.fill('input[type=password]', ADMIN_PASSWORD);
await page.fill('input[placeholder="2FA code"]', totpNow(ADMIN_MFA_SECRET));
await page.click('button:has-text("Sign in")');
await page.waitForTimeout(6000);

const body = (await page.textContent('body')) ?? '';
ok('signed in (login form gone)', !body.includes('2FA code'));
// 400 = past the guard and into validation; 401 would mean the session did not take.
ok('bulk booking is authorized after signing in', await probe(page) === 400);

await ctx.storageState({ path: STATE });
console.log(`  session saved to ${STATE}`);
await browser.close();
finish('admin login');
