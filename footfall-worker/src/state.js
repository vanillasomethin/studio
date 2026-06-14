// In-memory per-store state for the footfall pipeline.
//
// All of this is process-local and intentionally NOT persisted — it's a
// rolling window of recent activity used to decide whether the *next*
// event should be counted. The durable record (every event, with its
// exclusion reason if any) is always written to FootfallEvent — see
// pipeline.js. If the worker restarts, dwell/baseline/dedup state resets,
// which only affects classification of the first few minutes of events,
// never the audit trail.

const stores = new Map();

function storeState(storeId) {
  let s = stores.get(storeId);
  if (!s) {
    s = {
      // Layer 1 — staff dwell tracking, keyed by track_id
      // trackId -> { firstSeen, lastSeen, zoneId }
      tracks: new Map(),

      // Layer 2 — baseline noise floor, computed once per calibration window per day
      baseline: { amplitude: null, calibratedOnDateIst: null, samples: [] },

      // Rule C — dedup: last counted timestamp per (zoneId|detectionMethod)
      lastEventAtByKey: new Map(),

      // Rule C — recent "motion" events awaiting presence confirmation
      // detectionMethod -> timestampMs
      pendingMotionAt: new Map(),

      // Rule A — last ESPresense BLE delta timestamp (ms), for corroboration
      lastBleDeltaAtMs: null,
    };
    stores.set(storeId, s);
  }
  return s;
}

export function getStoreState(storeId) {
  return storeState(storeId);
}

/** IST calendar date string ("YYYY-MM-DD") for a given Date, used to key daily baseline calibration. */
export function istDateString(date) {
  const istMs = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}
