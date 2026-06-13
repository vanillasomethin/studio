// 3-layer staff exclusion.
//
// Every event is always written to FootfallEvent with `exclusionReason`
// set (or null). Exclusion never silently drops an event — it just keeps
// it out of the counted total (`isCounted = false`).
//
// Layer 1 — STAFF_DWELL: a track that has been continuously present for
//           more than `dwellMs` (default 2h) is assumed to be staff.
//           "Continuously" resets if the track disappears for more than
//           `dwellResetMs` (default 10min).
// Layer 2 — BELOW_BASELINE: during the 06:00–07:00 IST calibration window
//           each day we record the empty-store noise floor (average CSI
//           amplitude). Outside that window, any event whose amplitude is
//           below `baseline * baselineMultiplier` is treated as noise.
// Layer 3 — STAFF_ZONE: `Store.excludedZoneId` is a zone (e.g. the counter
//           / back room) that is never counted, regardless of signal.

import { config, isWithinIstWindow } from './config.js';
import { istDateString } from './state.js';

/**
 * @param {object} storeState  per-store in-memory state (see state.js)
 * @param {{ excludedZoneId: string | null }} store
 * @param {{ trackId?: string, zoneId?: string|null, amplitude?: number|null, timestamp: Date }} event
 * @returns {string | null} exclusion reason, or null if not excluded
 */
export function classifyExclusion(storeState, store, event) {
  const nowMs = event.timestamp.getTime();

  // ── Layer 1: dwell tracking (always update, even if excluded elsewhere) ──
  let dwellExcluded = false;
  if (event.trackId) {
    const prev = storeState.tracks.get(event.trackId);
    if (!prev || nowMs - prev.lastSeen > config.staffExclusion.dwellResetMs) {
      storeState.tracks.set(event.trackId, { firstSeen: nowMs, lastSeen: nowMs, zoneId: event.zoneId ?? null });
    } else {
      prev.lastSeen = nowMs;
      prev.zoneId = event.zoneId ?? prev.zoneId;
    }
    const track = storeState.tracks.get(event.trackId);
    dwellExcluded = nowMs - track.firstSeen >= config.staffExclusion.dwellMs;
  }

  // ── Layer 3: configured staff zone (highest priority — explicit config) ──
  if (store.excludedZoneId && event.zoneId && event.zoneId === store.excludedZoneId) {
    return 'STAFF_ZONE';
  }

  if (dwellExcluded) return 'STAFF_DWELL';

  // ── Layer 2: baseline noise floor ─────────────────────────────────────
  const { baselineWindow, baselineMultiplier } = config.staffExclusion;
  const today = istDateString(event.timestamp);

  if (isWithinIstWindow(event.timestamp, baselineWindow.start, baselineWindow.end)) {
    // Inside the calibration window: accumulate samples, (re)calibrate once per day.
    if (event.amplitude != null) {
      if (storeState.baseline.calibratedOnDateIst !== today) {
        storeState.baseline.samples = [];
      }
      storeState.baseline.samples.push(event.amplitude);
      const samples = storeState.baseline.samples;
      storeState.baseline.amplitude = samples.reduce((a, b) => a + b, 0) / samples.length;
      storeState.baseline.calibratedOnDateIst = today;
    }
    // Never reject events during calibration — we're learning the floor.
    return null;
  }

  if (
    storeState.baseline.amplitude != null &&
    event.amplitude != null &&
    event.amplitude < storeState.baseline.amplitude * baselineMultiplier
  ) {
    return 'BELOW_BASELINE';
  }

  return null;
}

/** Calibration status for StoreSensorHealth, derived from baseline state. */
export function calibrationStatus(storeState, now) {
  if (storeState.baseline.amplitude != null) return 'calibrated';
  if (isWithinIstWindow(now, config.staffExclusion.baselineWindow.start, config.staffExclusion.baselineWindow.end)) {
    return 'calibrating';
  }
  return 'pending';
}
