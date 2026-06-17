// Core pipeline: turns a RuView CSI "arrival"/"shelf_interaction"/"queue"
// message into a FootfallEvent row, an FootfallHourly upsert, and (for
// shelf_interaction) a ScreenPresenceEvent — applying staff exclusion,
// dedup/ghost filtering, signal fusion, and store-hours gating along the way.

import { db } from './db.js';
import { config, isWithinIstWindow, hourBucketUtc } from './config.js';
import { getStoreState } from './state.js';
import { classifyExclusion } from './staffExclusion.js';
import { recordMotion, classifyDedupAndGhost } from './dedup.js';
import { recordBleDelta, isBleCorroborated, shouldCount } from './signalFusion.js';
import { recordScreenPresence } from './presence.js';

/**
 * @param {{ excludedZoneId: string | null }} store
 * @param {object} payload  parsed RuView message
 *   { node_id, store_id, module, event, track_id?, zone_id?, amplitude?,
 *     confidence?, dwell_ms?, timestamp }
 */
export async function handleRuviewEvent(store, payload) {
  const storeId = store.id;
  const storeState = getStoreState(storeId);
  const timestamp = new Date(payload.timestamp);

  // "motion" pings never become FootfallEvent rows — just recorded for ghost rejection.
  if (payload.event === 'motion') {
    recordMotion(storeState, payload.track_id, timestamp);
    return;
  }

  const baseEvent = {
    storeId,
    timestamp,
    amplitude: payload.amplitude ?? null,
    confidenceScore: payload.confidence ?? null,
    zoneId: payload.zone_id ?? null,
    detectionMethod: payload.module ?? null,
    trackId: payload.track_id,
    dwellMs: payload.dwell_ms ?? null,
  };

  // Out of store hours: not counted, but still recorded for audit.
  if (!isWithinIstWindow(timestamp, config.storeHours.start, config.storeHours.end)) {
    await writeFootfallEvent({ ...baseEvent, isCounted: false, exclusionReason: 'OUTSIDE_STORE_HOURS', bleCorroborated: false });
    return;
  }

  // 3-layer staff exclusion.
  const exclusionReason = classifyExclusion(storeState, store, baseEvent);
  if (exclusionReason) {
    await writeFootfallEvent({ ...baseEvent, isCounted: false, exclusionReason, bleCorroborated: false });
    if (payload.module === 'shelf-interaction') {
      await recordScreenPresence(storeId, timestamp, false, baseEvent.confidenceScore);
    }
    return;
  }

  // Dedup + ghost filter.
  const rejection = classifyDedupAndGhost(storeState, baseEvent);
  if (rejection) {
    await writeFootfallEvent({ ...baseEvent, isCounted: false, exclusionReason: rejection, bleCorroborated: false });
    if (payload.module === 'shelf-interaction') {
      await recordScreenPresence(storeId, timestamp, false, baseEvent.confidenceScore);
    }
    return;
  }

  // Signal fusion: BLE corroboration or high CSI confidence.
  const bleCorroborated = isBleCorroborated(storeState, baseEvent);
  const counted = shouldCount({ confidence: baseEvent.confidenceScore }, bleCorroborated);

  await writeFootfallEvent({ ...baseEvent, isCounted: counted, exclusionReason: null, bleCorroborated });

  if (payload.module === 'shelf-interaction') {
    await recordScreenPresence(storeId, timestamp, counted, baseEvent.confidenceScore);
  }
}

/** ESPresense `ble/delta` — used only for signal-fusion corroboration. */
export function handleBleDelta(store, payload) {
  const storeState = getStoreState(store.id);
  recordBleDelta(storeState, new Date(payload.timestamp));
}

async function writeFootfallEvent(event) {
  await db.footfallEvent.create({
    data: {
      storeId: event.storeId,
      timestamp: event.timestamp,
      amplitude: event.amplitude,
      confidenceScore: event.confidenceScore,
      bleCorroborated: event.bleCorroborated,
      isCounted: event.isCounted,
      exclusionReason: event.exclusionReason,
      zoneId: event.zoneId,
      detectionMethod: event.detectionMethod,
    },
  });

  await upsertHourly(event);
}

async function upsertHourly(event) {
  const hourBucket = hourBucketUtc(event.timestamp);
  const counted = event.isCounted ? 1 : 0;
  const unconfirmed = !event.isCounted && event.exclusionReason === null ? 1 : 0;
  const excluded = event.exclusionReason != null ? 1 : 0;

  const existing = await db.footfallHourly.findUnique({ where: { storeId_hourBucket: { storeId: event.storeId, hourBucket } } });

  if (!existing) {
    await db.footfallHourly.create({
      data: {
        storeId: event.storeId,
        hourBucket,
        customerCount: counted,
        unconfirmedCount: unconfirmed,
        excludedCount: excluded,
        avgConfidence: event.confidenceScore,
      },
    });
    return;
  }

  // Running average of confidence across all events in the hour (counted or not).
  const totalEvents = existing.customerCount + existing.unconfirmedCount + existing.excludedCount;
  const prevAvg = existing.avgConfidence ?? 0;
  const newAvg = event.confidenceScore != null
    ? (prevAvg * totalEvents + event.confidenceScore) / (totalEvents + 1)
    : existing.avgConfidence;

  await db.footfallHourly.update({
    where: { storeId_hourBucket: { storeId: event.storeId, hourBucket } },
    data: {
      customerCount: existing.customerCount + counted,
      unconfirmedCount: existing.unconfirmedCount + unconfirmed,
      excludedCount: existing.excludedCount + excluded,
      avgConfidence: newAvg,
    },
  });
}
