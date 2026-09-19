// Nine bulk-booking scenarios against the live API, then the rows they produced.
//
// These are the same selling rules scripts/verify-slot-booking.mjs proves as pure
// math, re-checked through HTTP + auth + Prisma + the unique constraint, because a
// planner that is right in isolation can still be wired up wrong.
//
// Starts by clearing SlotBooking so the expected numbers are exact on a re-run.

import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { assertLocalDb, BASE_URL, CHROME, eq, ok, finish } from './guard.mjs';
import { isOpenOn } from '../../src/lib/slots.ts';

assertLocalDb();
const db = new PrismaClient();
const STATE = new URL('./state.json', import.meta.url).pathname;

await db.slotBooking.deleteMany({});

const stores = Object.fromEntries(
  (await db.store.findMany({ select: { id: true, storeName: true, loopSlotCount: true, openDays: true } }))
    .map((s) => [s.storeName.split(' ')[0], s]));
const camps = Object.fromEntries(
  (await db.campaign.findMany({ select: { id: true, name: true } }))
    .map((c) => [c.name.split(' ')[0], c]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ storageState: STATE })).newPage();
await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

const book = (body) => page.evaluate(async ([base, b]) => {
  const r = await fetch(`${base}/api/slots/bookings/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
  });
  return { status: r.status, json: await r.json() };
}, [BASE_URL, body]);

// Mon–Sun, so a Mon–Fri store contributes exactly two closed days.
const WEEK = { from: '2026-10-05', to: '2026-10-11' };
const sum  = (r, ...keys) => ({ status: r.status, ...Object.fromEntries(keys.map((k) => [k, r.json[k]])) });

console.log('automatic allocation');

eq('a 10s ad books 3 plays a day for a week',
  sum(await book({ campaignId: camps.Amul.id, storeIds: [stores.Balmatta.id], ...WEEK, slotsPerDay: 3 }),
      'booked', 'requested', 'missed'),
  { status: 200, booked: 21, requested: 21, missed: 0 });

eq('re-running the same request books nothing new',
  sum(await book({ campaignId: camps.Amul.id, storeIds: [stores.Balmatta.id], ...WEEK, slotsPerDay: 3 }),
      'booked', 'alreadySatisfied'),
  { status: 200, booked: 0, alreadySatisfied: 21 });

// 7 plays of a 30s ad = 21 rows: the span is what separates plays from rows.
eq('a 30s ad takes three consecutive slots per play',
  sum(await book({ campaignId: camps.Malabar.id, storeIds: [stores.Balmatta.id], ...WEEK, slotsPerDay: 1 }),
      'booked', 'rowsBooked', 'slotSpan'),
  { status: 200, booked: 7, rowsBooked: 21, slotSpan: 3 });

const full = await book({ campaignId: camps.Nandini.id, storeIds: [stores.Balmatta.id], ...WEEK, slotsPerDay: 2 });
eq('a request that lands nothing is a 409, not a green "booked: 0"',
  sum(full, 'booked', 'missed'), { status: 409, booked: 0, missed: 14 });
ok('the 409 still carries a per-day gap list',
  full.json.gaps?.length === 7 && full.json.gaps.every((g) => g.reason === 'full'),
  `${full.json.gaps?.length} gaps`);

console.log('\nmanual allocation');

const overlap = await book({ campaignId: camps.Malabar.id, storeIds: [stores.Kadri.id], ...WEEK, positions: [4, 5] });
eq('overlapping picks for a 30s ad are refused up front', overlap.status, 400);
ok('the refusal names the clashing positions', /5 and 6 overlap/.test(overlap.json.error ?? ''),
  overlap.json.error);

eq('legally spaced picks are honoured verbatim',
  sum(await book({ campaignId: camps.Malabar.id, storeIds: [stores.Kadri.id], ...WEEK, positions: [0, 3] }),
      'booked', 'rowsBooked'),
  { status: 200, booked: 14, rowsBooked: 42 });

// The rule that separates manual from automatic: no silent substitution.
eq('a pick on a sold slot is a gap, never relocated',
  sum(await book({ campaignId: camps.Nandini.id, storeIds: [stores.Kadri.id], ...WEEK, positions: [1] }),
      'booked', 'missed'),
  { status: 409, booked: 0, missed: 7 });

console.log('\nclosed days and copy-day');

eq('a Mon–Fri store skips its two closed days',
  sum(await book({ campaignId: camps.Amul.id, storeIds: [stores.Bejai.id], ...WEEK, slotsPerDay: 2 }),
      'booked', 'closedSkipped'),
  { status: 200, booked: 10, closedSkipped: 2 });

// Kadri already holds Malabar as a span group at 3–5 and singles at 0–2, so the
// copied 30s window is already satisfied while the three 10s units are blocked.
eq('copy-day counts a matching span window as satisfied, blocked singles as missed',
  sum(await book({ mode: 'copy-day', sourceStoreId: stores.Balmatta.id, sourceDate: '2026-10-05',
                   storeIds: [stores.Kadri.id], from: '2026-10-06', to: '2026-10-11' }),
      'booked', 'alreadySatisfied', 'missed'),
  { status: 200, booked: 0, alreadySatisfied: 6, missed: 18 });

await browser.close();

console.log('\nthe rows those requests actually wrote');

const rows = await db.slotBooking.findMany({
  select: { storeId: true, date: true, slotPosition: true, campaignId: true, spanId: true },
});
const byId = Object.fromEntries(Object.values(stores).map((s) => [s.id, s]));

ok('no loop position is double-booked',
  new Set(rows.map((r) => `${r.storeId}|${r.date.toISOString().slice(0, 10)}|${r.slotPosition}`)).size === rows.length,
  `${rows.length} rows`);

const groups = new Map();
for (const r of rows) if (r.spanId) groups.set(r.spanId, [...(groups.get(r.spanId) ?? []), r]);
const positions = (g) => g.map((x) => x.slotPosition).sort((a, b) => a - b);
ok('every 30s span group kept all three rows',
  [...groups.values()].every((g) => g.length === 3), `${groups.size} groups`);
ok('every span group is consecutive',
  [...groups.values()].every((g) => positions(g).every((p, i, a) => i === 0 || p === a[i - 1] + 1)));
ok('no span group straddles a store or a day',
  [...groups.values()].every((g) => new Set(g.map((x) => `${x.storeId}|${x.date.toISOString()}`)).size === 1));
ok('no row sits outside its store’s loop',
  rows.every((r) => r.slotPosition < byId[r.storeId].loopSlotCount));
ok('no row lands on a day its store is shut',
  rows.every((r) => isOpenOn(byId[r.storeId].openDays, r.date.toISOString().slice(0, 10))));

await db.$disconnect();
finish('bulk booking e2e');
