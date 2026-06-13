// Signal fusion (rule A).
//
// A CSI "arrival" from RuView becomes a COUNTED footfall event only if:
//   - an ESPresense BLE delta (a new/departing device) was seen within
//     `bleCorroborationWindowMs` (10s default) of the arrival, OR
//   - the RuView confidence score alone exceeds `highConfidenceThreshold`
//     (0.85 default)
//
// and it passed staff-exclusion (staffExclusion.js) and dedup/ghost
// filtering (dedup.js), and it falls within store hours.
//
// Events that pass CSI + staff-exclusion + dedup but fail BLE
// corroboration (and aren't high-confidence) are stored as
// `exclusionReason: null, isCounted: false` with `bleCorroborated: false`
// — these are the "UNCONFIRMED" events from the spec: real CSI detections
// that simply couldn't be cross-checked against BLE.

import { config } from './config.js';

/** Record a BLE delta ping for a store (ESPresense `ble/delta` topic). */
export function recordBleDelta(storeState, timestamp) {
  storeState.lastBleDeltaAtMs = timestamp.getTime();
}

/**
 * @param {object} storeState
 * @param {{ confidence?: number|null, timestamp: Date }} event
 * @returns {boolean} whether this arrival is BLE-corroborated
 */
export function isBleCorroborated(storeState, event) {
  const nowMs = event.timestamp.getTime();
  const lastBle = storeState.lastBleDeltaAtMs;
  if (lastBle != null && nowMs - lastBle <= config.fusion.bleCorroborationWindowMs) {
    return true;
  }
  return false;
}

/**
 * @param {{ confidence?: number|null }} event
 * @param {boolean} bleCorroborated
 * @returns {boolean} whether the arrival should be counted (rule A)
 */
export function shouldCount(event, bleCorroborated) {
  if (bleCorroborated) return true;
  return (event.confidence ?? 0) > config.fusion.highConfidenceThreshold;
}
