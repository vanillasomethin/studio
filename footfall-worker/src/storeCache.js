// Small TTL cache for Store lookups (just `excludedZoneId`), so we don't
// hit Postgres on every MQTT message. Refreshed every 5 minutes — an admin
// changing a store's excluded zone takes effect within that window.

import { db } from './db.js';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // storeId -> { store, fetchedAt }

export async function getStore(storeId) {
  const cached = cache.get(storeId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.store;

  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, excludedZoneId: true } });
  if (!store) return null;

  cache.set(storeId, { store, fetchedAt: Date.now() });
  return store;
}
