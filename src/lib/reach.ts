// Verified Footfall vs Estimated Reach — per-campaign audience reporting.
//
// Two genuinely different numbers, kept apart on purpose (spec: "don't blend the two
// into one network-wide number"):
//
//   Verified Footfall — measured. Summed FootfallHourly.customerCount (the sensor
//     pipeline's already-deduped, staff-excluded, signal-fused count — see
//     footfall-worker/src/{dedup,staffExclusion,signalFusion}.js) for the store-hours
//     that overlap the campaign's flight, at stores with an active sensor. This counts
//     passersby in sensor range — NOT confirmed ad viewership. (That finer-grained
//     number — "was someone present at the exact moment this ad aired" — already exists
//     separately as ScreenPresenceEvent / GET /api/presence/:campaignId and is not
//     touched here.)
//
//   Estimated Reach — the pre-existing softer estimate, unchanged: PlayEvent.impressions
//     summed, for stores with no sensor coverage. One play defaults to one impression
//     (see PlayEvent.impressions in schema.prisma) — the same figure T2 CPI billing
//     already assumes.
//
// A store is "sensor-covered" if RuView has reported within the last 48h. RuView alone
// can produce isCounted=true events (signal-fusion rule A: high CSI confidence OR BLE
// corroboration) — ESPresense sharpens the count but isn't required for coverage, so
// gating on RuView is the correct boundary, not "both sensors present."
export const SENSOR_COVERAGE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isSensorCovered(
  ruviewLastSeen: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!ruviewLastSeen) return false;
  return now.getTime() - ruviewLastSeen.getTime() <= SENSOR_COVERAGE_WINDOW_MS;
}

export type ReachSummary = {
  verifiedFootfall: number;
  verifiedStoreCount: number;
  estimatedReach: number;
  estimatedStoreCount: number;
  /** Stores the campaign ran at but that have no play data yet — neither number counts them. */
  totalStoreCount: number;
};

/** Pure aggregation: given which stores are sensor-covered, split the two source
 *  datasets into the two reported figures without ever summing across them. */
export function summarizeReach(args: {
  storeIds: string[];
  coveredStoreIds: Set<string>;
  footfallByStore: Map<string, number>;   // storeId -> summed customerCount (covered stores)
  impressionsByStore: Map<string, number>; // storeId -> summed impressions (uncovered stores)
}): ReachSummary {
  let verifiedFootfall = 0, verifiedStoreCount = 0;
  let estimatedReach = 0, estimatedStoreCount = 0;

  for (const storeId of args.storeIds) {
    if (args.coveredStoreIds.has(storeId)) {
      const n = args.footfallByStore.get(storeId) ?? 0;
      verifiedFootfall += n;
      if (n > 0) verifiedStoreCount++;
    } else {
      const n = args.impressionsByStore.get(storeId) ?? 0;
      estimatedReach += n;
      if (n > 0) estimatedStoreCount++;
    }
  }

  return {
    verifiedFootfall, verifiedStoreCount,
    estimatedReach, estimatedStoreCount,
    totalStoreCount: args.storeIds.length,
  };
}
