// Server-side Firebase Cloud Messaging helper.
// Uses the lazy-init pattern (never module-level) to avoid breaking SSG.
// Set FIREBASE_SERVICE_ACCOUNT_JSON env var to a JSON string of the service account.

import type { App } from 'firebase-admin/app';
import { db } from '@/lib/db';

let _app: App | null = null;

function getFirebaseApp(): App | null {
  if (_app) return _app;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app') as typeof import('firebase-admin/app');
    if (getApps().length > 0) {
      _app = getApps()[0];
      return _app;
    }
    _app = initializeApp({ credential: cert(JSON.parse(json)) });
    return _app;
  } catch {
    return null;
  }
}

/**
 * Sends a `plan_updated` FCM data message to the given device IDs.
 * Silently no-ops if FIREBASE_SERVICE_ACCOUNT_JSON is not set.
 * Never throws — push is best-effort.
 */
export async function pushPlanUpdated(deviceIds: string[]): Promise<void> {
  if (!deviceIds.length) return;
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const devices = await db.device.findMany({
      where: { id: { in: deviceIds }, fcmToken: { not: null } },
      select: { fcmToken: true },
    });
    const tokens = devices.map((d) => d.fcmToken!).filter(Boolean);
    if (!tokens.length) return;

    const { getMessaging } = require('firebase-admin/messaging') as typeof import('firebase-admin/messaging');
    const messaging = getMessaging(app);

    // Send in chunks of 500 (FCM sendEachForMulticast limit)
    const CHUNK = 500;
    for (let i = 0; i < tokens.length; i += CHUNK) {
      await messaging.sendEachForMulticast({
        tokens: tokens.slice(i, i + CHUNK),
        data: { type: 'plan_updated' },
        android: { priority: 'high' },
      });
    }
  } catch {
    // best-effort — never break the API response
  }
}

/**
 * Resolves device IDs affected by a schedule's targeting fields.
 * Used before calling pushPlanUpdated.
 */
export async function resolveScheduleDeviceIds(schedule: {
  deviceIds: string[];
  groupName?: string | null;
  storeIds?: string[];
  cityFilter?: string | null;
}): Promise<string[]> {
  const ids = new Set<string>(schedule.deviceIds);

  if (schedule.groupName) {
    const rows = await db.device.findMany({
      where: { groupName: schedule.groupName },
      select: { id: true },
    });
    for (const r of rows) ids.add(r.id);
  }

  if (schedule.storeIds?.length) {
    const rows = await db.device.findMany({
      where: { storeId: { in: schedule.storeIds } },
      select: { id: true },
    });
    for (const r of rows) ids.add(r.id);
  }

  if (schedule.cityFilter) {
    const stores = await db.store.findMany({
      where: { city: { equals: schedule.cityFilter, mode: 'insensitive' } },
      select: { id: true },
    });
    if (stores.length) {
      const rows = await db.device.findMany({
        where: { storeId: { in: stores.map((s) => s.id) } },
        select: { id: true },
      });
      for (const r of rows) ids.add(r.id);
    }
  }

  return Array.from(ids);
}
