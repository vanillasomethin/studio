// Books today and follows the booking all the way to the screen.
//
// A booking that never reaches a device plan is a sale that airs nowhere, so this
// claims a device exactly as a first-boot Android TV does, pairs it, and asserts
// the loop the player is handed: a 30s ad as ONE item covering three positions,
// and an unsold position carrying a bonus replay rather than going dark.

import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { assertLocalDb, BASE_URL, CHROME, eq, ok, finish } from './guard.mjs';
import { istToday, SLOT_DURATION_MS } from '../../src/lib/slots.ts';

assertLocalDb();
const db = new PrismaClient();
const STATE = new URL('./state.json', import.meta.url).pathname;
const HARDWARE_KEY = 'E2E-TV-BALMATTA-01';

const store = await db.store.findFirstOrThrow({ where: { storeName: 'Balmatta Kirana' } });
const amul  = await db.campaign.findFirstOrThrow({ where: { name: { startsWith: 'Amul' } } });
const gold  = await db.campaign.findFirstOrThrow({ where: { name: { startsWith: 'Malabar' } } });

const today = istToday(new Date());
await db.slotBooking.deleteMany({ where: { storeId: store.id, date: new Date(`${today}T00:00:00Z`) } });

// Book through the real API, as an operator would.
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ storageState: STATE })).newPage();
await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
const book = (body) => page.evaluate(async ([base, b]) => {
  const r = await fetch(`${base}/api/slots/bookings/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
  });
  return { status: r.status, json: await r.json() };
}, [BASE_URL, body]);

const day = { from: today, to: today };
eq('two 10s plays booked for today',
  (await book({ campaignId: amul.id, storeIds: [store.id], ...day, slotsPerDay: 2 })).json.booked, 2);
eq('one 30s play booked for today',
  (await book({ campaignId: gold.id, storeIds: [store.id], ...day, slotsPerDay: 1 })).json.rowsBooked, 3);
await browser.close();

// Claim as a first-boot player does, then pair (what an admin does in Screens).
const claim = await fetch(`${BASE_URL}/api/device/claim`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hardwareKey: HARDWARE_KEY, name: 'E2E Balmatta Screen' }),
});
const claimed = await claim.json();
ok('device claim succeeds', claim.status === 200 && !!claimed.token);

const deviceId = claimed.deviceId ?? claimed.device?.id;
await db.device.update({ where: { id: deviceId }, data: { storeId: store.id, pairedAt: new Date() } });
const device = await db.device.findUniqueOrThrow({ where: { id: deviceId } });

const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' })
  .setSubject(device.id).setIssuedAt().setExpirationTime('2h')
  .sign(new TextEncoder().encode(device.jwtSecret));

const res  = await fetch(`${BASE_URL}/api/device/plan`, { headers: { authorization: `Bearer ${token}` } });
const plan = await res.json();
ok('plan fetch succeeds', res.status === 200);

// The slot loop is the store's base programming, which the wire calls `fallback`.
const loop = plan.fallback ?? [];
const byPos = Object.fromEntries(loop.map((i) => [i.slotPosition, i]));

console.log('\nthe loop this screen receives');
for (const i of loop) {
  console.log(`  pos ${String(i.slotPosition).padStart(2)}  ${(i.campaignId === gold.id ? 'Malabar 30s' : i.campaignId === amul.id ? 'Amul 10s' : 'filler').padEnd(12)}` +
              ` ${String(i.durationMs).padStart(5)}ms${i.isFiller ? '  (bonus replay)' : '  (sold)'}`);
}

eq('the loop has an item for every playable position', loop.length, 4);
eq('position 0 is the sold 10s ad', [byPos[0]?.campaignId, byPos[0]?.durationMs], [amul.id, SLOT_DURATION_MS]);
eq('the 30s ad is ONE item of 30000ms at position 2',
  [byPos[2]?.campaignId, byPos[2]?.durationMs], [gold.id, 3 * SLOT_DURATION_MS]);
ok('the positions it covers carry no item of their own', !byPos[3] && !byPos[4]);
ok('the unsold position replays a sold ad rather than going dark',
  byPos[5]?.isFiller === true && byPos[5]?.campaignId === amul.id);
eq('the loop totals one slot-count of airtime',
  loop.reduce((n, i) => n + i.durationMs, 0), store.loopSlotCount * SLOT_DURATION_MS);
ok('every item carries the md5 the player caches on', loop.every((i) => !!i.md5));
ok('plan items stay in ascending order', loop.every((i, k, a) => k === 0 || i.order > a[k - 1].order));

await db.$disconnect();
finish('device plan e2e');
