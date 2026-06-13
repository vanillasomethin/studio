// Dedup + ghost filter (signal-fusion rule C).
//
// RuView's customer-flow module streams two kinds of messages per track:
//   - "motion"  — a CSI amplitude blip, very cheap to produce, very noisy
//   - "arrival" — a confirmed presence detection
//
// A "motion" message never becomes a FootfallEvent row by itself — it's
// just recorded as a timestamp so a following "arrival" can be checked
// against it (ghost rejection).
//
// For "arrival" messages:
//   - DUPLICATE        — another counted event in the same zone/detection
//                         method fired within `dedup.windowMs` (8s default)
//   - GHOST_NO_MOTION  — no "motion" message for this track in the
//                         `motionConfirmWindowMs` before this arrival
//   - BELOW_MIN_DWELL  — the firmware-reported dwell duration is shorter
//                         than `minDwellMs` (3s default) — too brief to be
//                         a real customer
//
// All three are returned as a reason string and the caller still writes a
// FootfallEvent row (isCounted = false, exclusionReason = reason) for audit.

import { config } from './config.js';

/** Record a "motion" ping for a track. Returns nothing — never produces a FootfallEvent. */
export function recordMotion(storeState, trackId, timestamp) {
  if (!trackId) return;
  storeState.pendingMotionAt.set(trackId, timestamp.getTime());
}

/**
 * @param {object} storeState
 * @param {{ trackId?: string, zoneId?: string|null, detectionMethod: string, dwellMs?: number|null, timestamp: Date }} event
 * @returns {string | null} rejection reason, or null if the event should be counted
 */
export function classifyDedupAndGhost(storeState, event) {
  const nowMs = event.timestamp.getTime();

  // Dedup: same zone + detection method firing again too soon.
  const dedupKey = `${event.zoneId ?? 'unknown'}|${event.detectionMethod}`;
  const lastAt = storeState.lastEventAtByKey.get(dedupKey);
  if (lastAt != null && nowMs - lastAt < config.dedup.windowMs) {
    return 'DUPLICATE';
  }

  // Ghost filter: arrival must be preceded by a "motion" ping for the same track.
  if (event.trackId) {
    const motionAt = storeState.pendingMotionAt.get(event.trackId);
    if (motionAt == null || nowMs - motionAt > config.dedup.motionConfirmWindowMs) {
      return 'GHOST_NO_MOTION';
    }
  }

  // Minimum dwell: too-brief presence is treated as a ghost.
  if (event.dwellMs != null && event.dwellMs < config.dedup.minDwellMs) {
    return 'BELOW_MIN_DWELL';
  }

  storeState.lastEventAtByKey.set(dedupKey, nowMs);
  return null;
}
