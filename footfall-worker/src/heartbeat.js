// Device heartbeats (rule E) — `alive/<store_id>/device/ruview_heartbeat`
// and `.../device/espresense_heartbeat`. Upserts StoreSensorHealth, which
// drives `/api/health/:storeId` in studio.

import { db } from './db.js';
import { calibrationStatus } from './staffExclusion.js';
import { getStoreState } from './state.js';

/**
 * @param {string} storeId
 * @param {'ruview' | 'espresense'} node
 * @param {{ uptime_pct?: number, firmware?: string, timestamp: string }} payload
 */
export async function handleHeartbeat(storeId, node, payload) {
  const now = new Date(payload.timestamp);
  const storeState = getStoreState(storeId);

  const data = node === 'ruview'
    ? { ruviewLastSeen: now, ruviewUptime: payload.uptime_pct ?? null }
    : { espresenseLastSeen: now, espresenseUptime: payload.uptime_pct ?? null };

  if (payload.firmware) data.firmwareVersion = payload.firmware;
  if (node === 'ruview') data.calibrationStatus = calibrationStatus(storeState, now);

  await db.storeSensorHealth.upsert({
    where: { storeId },
    create: { storeId, ...data },
    update: data,
  });
}
