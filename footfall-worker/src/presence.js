// Screen presence correlation (rule D).
//
// On a "shelf_interaction" event from RuView, find the campaign that was
// playing on this store's screen(s) at that moment (via PlayEvent, which
// already carries proof-of-play + campaign attribution) and write a
// ScreenPresenceEvent. This powers "% of ad plays with confirmed presence"
// in the admin Footfall tab and the brand-facing /api/presence/:campaignId
// endpoint.

import { db } from './db.js';

/**
 * @param {string} storeId
 * @param {Date} timestamp
 * @param {boolean} presenceDetected  whether the shelf interaction was a
 *                                     counted footfall event (vs excluded)
 * @param {number|null} confidenceScore
 */
export async function recordScreenPresence(storeId, timestamp, presenceDetected, confidenceScore) {
  const devices = await db.device.findMany({ where: { storeId }, select: { id: true } });
  if (devices.length === 0) return;

  const deviceIds = devices.map((d) => d.id);

  // The PlayEvent that was airing at `timestamp` on any of this store's screens.
  const playEvent = await db.playEvent.findFirst({
    where: {
      deviceId: { in: deviceIds },
      campaignId: { not: null },
      startedAt: { lte: timestamp },
      endedAt: { gte: timestamp },
    },
    orderBy: { startedAt: 'desc' },
  });

  await db.screenPresenceEvent.create({
    data: {
      storeId,
      campaignId: playEvent?.campaignId ?? null,
      timestamp,
      presenceDetected,
      confidenceScore,
      interactionType: 'shelf_interaction',
    },
  });
}
