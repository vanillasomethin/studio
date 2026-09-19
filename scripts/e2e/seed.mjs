// Seeds a disposable local database with just enough fleet to sell slots:
// one admin who can actually log in (password + TOTP), three slot-mode stores
// whose loop sizes and opening days differ, and campaigns carrying a 10s and a
// 30s creative so both span classes are exercised.
//
// Safe to re-run: every row is upserted by a natural key.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { assertLocalDb } from './guard.mjs';
import { totpNow } from './totp.mjs';
import { verifyTotpStep } from '../../src/lib/totp.ts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_MFA_SECRET } from './fixtures.mjs';

assertLocalDb();
const db = new PrismaClient();


const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

// Bejai trades Mon–Fri, so the closed-day rule is live rather than theoretical.
const STORES = [
  { key: 'balmatta', name: 'Balmatta Kirana',   loop: 6,  openDays: 127,       locality: 'Balmatta' },
  { key: 'kadri',    name: 'Kadri Supermarket', loop: 10, openDays: 127,       locality: 'Kadri'    },
  { key: 'bejai',    name: 'Bejai Stores',      loop: 6,  openDays: 0b0011111, locality: 'Bejai'    },
];

async function main() {
  // The login only works if our generator agrees with the app's verifier.
  const probe = totpNow(ADMIN_MFA_SECRET);
  if (verifyTotpStep(ADMIN_MFA_SECRET, probe) === null) {
    throw new Error('TOTP generator disagrees with src/lib/totp.ts — fix scripts/e2e/totp.mjs');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await db.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: { passwordHash, role: 'ADMIN', mfaSecret: ADMIN_MFA_SECRET, mfaEnabledAt: new Date(), mfaLastStep: null },
    create: { email: ADMIN_EMAIL, name: 'E2E Admin', role: 'ADMIN', passwordHash,
              mfaSecret: ADMIN_MFA_SECRET, mfaEnabledAt: new Date() },
  });
  console.log('admin     ', admin.email, admin.role, '(TOTP enrolled)');

  for (const s of STORES) {
    const phone = `+9190000${s.key.slice(0, 4).padEnd(4, '0')}`;
    const u = await db.user.upsert({
      where: { phone }, update: {},
      create: { phone, name: s.name, role: 'STORE_PARTNER' },
    });
    const store = await db.store.upsert({
      where:  { userId: u.id },
      update: { loopSlotCount: s.loop, openDays: s.openDays },
      create: {
        userId: u.id, storeName: s.name, ownerName: `${s.name} Owner`, whatsapp: phone,
        referralCode: `REF${s.key.toUpperCase().slice(0, 5)}`, locality: s.locality,
        city: 'Mangaluru', pincode: '575001', lat: 12.87, lng: 74.84,
        loopSlotCount: s.loop, openDays: s.openDays, onboardingStage: 'live',
      },
    });
    console.log('store     ', store.storeName.padEnd(18), `loop=${store.loopSlotCount}`, `openDays=${store.openDays}`);
  }

  const content = async (name, durationMs) => db.content.upsert({
    where:  { objectKey: `e2e/${name}.mp4` },
    update: { durationMs },
    create: { name, type: 'VIDEO', objectKey: `e2e/${name}.mp4`, md5: md5(name),
              sizeBytes: BigInt(1024), durationMs },
  });
  const c10 = await content('tenSecondAd', 10_000);
  const c30 = await content('thirtySecondAd', 30_000);

  for (const c of [
    { name: 'Amul — 10s',         contentId: c10.id },
    { name: 'Nandini — 10s',      contentId: c10.id },
    { name: 'Malabar Gold — 30s', contentId: c30.id },
  ]) {
    const found = await db.campaign.findFirst({ where: { name: c.name } });
    const row = found
      ? await db.campaign.update({ where: { id: found.id }, data: { slotContentId: c.contentId, status: 'active' } })
      : await db.campaign.create({ data: {
          name: c.name, status: 'active', slotContentId: c.contentId,
          startDate: new Date('2026-09-01T00:00:00Z'),
          screens: 3, months: 1, pricePerScreen: 799, totalAmount: 2397,
        } });
    console.log('campaign  ', row.name);
  }

  console.log(`\nsign in at /admin as ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} / TOTP from the seeded secret`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e.message ?? e); await db.$disconnect(); process.exit(1); });
