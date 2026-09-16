// Seed 10 single-slot test campaigns (and optionally book them) for a slot-mode store.
//
//   node scripts/seed-test-campaigns.mjs                       # dry run, shows the plan
//   node scripts/seed-test-campaigns.mjs --commit              # create the 10 campaigns
//   node scripts/seed-test-campaigns.mjs --commit --book       # ...and book positions 0-9 today
//   node scripts/seed-test-campaigns.mjs --commit --book --date=2026-09-17
//   node scripts/seed-test-campaigns.mjs --cleanup --commit    # delete what this script made
//
// Options: --store="ALIVE Test TV"  --count=10
//
// Every campaign gets a real Content row as its slotContentId — a campaign without one
// books fine and plays nothing, which is the failure this script exists to avoid.
// Campaigns are named "TEST Ad NN" and tagged via orderId "test-seed:<n>" so --cleanup
// can find exactly these rows and nothing else.

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag    = (name) => process.argv.includes(`--${name}`);
const COMMIT  = flag('commit');
const BOOK    = flag('book');
const CLEANUP = flag('cleanup');
const STORE   = arg('store', 'ALIVE Test TV');
const COUNT   = Number(arg('count', '10'));
const MARKER  = 'test-seed:';

// IST calendar date — the same convention SlotBooking.date uses.
const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const DATE = arg('date', istToday());

async function main() {
  const store = await db.store.findFirst({
    where:  { storeName: { contains: STORE, mode: 'insensitive' } },
    select: { id: true, storeName: true, loopSlotCount: true, openDays: true, fillerCreativeId: true },
  });
  if (!store) throw new Error(`No store matching "${STORE}"`);
  if (store.loopSlotCount == null) {
    throw new Error(`"${store.storeName}" is not in slot mode — set loopSlotCount in Admin → Stores first.`);
  }
  console.log(`store   ${store.storeName} (${store.id}) — ${store.loopSlotCount} slots, date ${DATE}`);

  if (CLEANUP) {
    const doomed = await db.campaign.findMany({
      where: { orderId: { startsWith: MARKER } }, select: { id: true, name: true },
    });
    console.log(`cleanup ${doomed.length} seeded campaigns (bookings cascade)`);
    if (COMMIT) await db.campaign.deleteMany({ where: { id: { in: doomed.map((c) => c.id) } } });
    return;
  }

  // Creatives: prefer real 10s single-slot clips, fall back to whatever exists.
  const creatives = await db.content.findMany({
    where:   { OR: [{ durationMs: { lte: 10_490 } }, { durationMs: null }] },
    select:  { id: true, name: true, durationMs: true },
    orderBy: { uploadedAt: 'desc' },
    take:    COUNT,
  });
  if (!creatives.length) throw new Error('No usable Content rows — upload a 10s creative first.');
  if (creatives.length < COUNT) {
    console.log(`note    only ${creatives.length} creatives available; they will be reused across campaigns`);
  }

  const startDate = new Date(`${DATE}T00:00:00Z`);
  for (let i = 0; i < COUNT; i++) {
    const n        = String(i + 1).padStart(2, '0');
    const creative = creatives[i % creatives.length];
    const data = {
      name: `TEST Ad ${n}`, orderId: `${MARKER}${n}`, status: 'trial',
      screens: 1, months: 1, pricePerScreen: 0, totalAmount: 0,
      startDate, slotContentId: creative.id,
    };
    console.log(`  ${data.name}  ← ${creative.name} (${creative.durationMs ?? 'image'})`);
    if (!COMMIT) continue;

    const campaign = await db.campaign.upsert({
      where: { orderId: data.orderId }, update: { slotContentId: creative.id }, create: data,
      select: { id: true },
    });
    if (BOOK) {
      if (i >= store.loopSlotCount) { console.log(`    skip booking — position ${i} is past the loop`); continue; }
      await db.slotBooking.upsert({
        where:  { storeId_date_slotPosition: { storeId: store.id, date: startDate, slotPosition: i } },
        update: { campaignId: campaign.id },
        create: { storeId: store.id, date: startDate, slotPosition: i, campaignId: campaign.id },
      });
    }
  }

  if (!COMMIT) { console.log('\ndry run — nothing written. Re-run with --commit.'); return; }
  const sold = await db.slotBooking.count({ where: { storeId: store.id, date: startDate } });
  console.log(`\ndone. ${sold} / ${store.loopSlotCount} positions sold on ${DATE}.`);
  console.log('The screen picks this up on its next /api/device/plan poll (or push a plan_updated from Admin).');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
