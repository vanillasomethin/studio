// Electricity estimation for partner screens.
//
// THIS PRODUCES AN ESTIMATE, NOT A MEASUREMENT. Only one of the three inputs is
// actually measured:
//
//   on-hours  — measured. Derived from HourlyPop.totalMs, i.e. real playback time
//               reported by the device, not scheduled hours.
//   watts     — assumed. The screen's rated draw, from Store.screenWatts if someone
//               recorded the actual TV, else a fleet default. This term dominates the
//               error: a 32" LED (~40 W) vs a 43" (~80 W) is a 2× swing.
//   tariff    — assumed, and really non-linear. MESCOM residential billing is slabbed,
//               so the marginal rate depends on the shop's TOTAL monthly consumption,
//               not the screen's. A single ₹/kWh constant cannot be exact.
//
// So: good enough to show a partner the value they receive, and to budget against.
// Not a substitute for a meter reading when settling a reimbursement — always render
// it labelled as an estimate, with the wattage and rate visible so the number can be
// checked.

/** Hours a screen actually played, from the hourly proof-of-play rollup.
 *  Each bucket is clamped to one hour: overlapping or replayed events can push a
 *  bucket's totalMs past wall-clock time, which would silently inflate the bill. */
export function onHoursFromBuckets(buckets: { totalMs: number }[]): number {
  const MS_PER_HOUR = 3_600_000;
  let ms = 0;
  for (const b of buckets) ms += Math.min(Math.max(b.totalMs, 0), MS_PER_HOUR);
  return ms / MS_PER_HOUR;
}

/** Energy in kWh for a screen drawing `watts` over `onHours`. */
export function estimateKwh(watts: number, onHours: number): number {
  if (watts <= 0 || onHours <= 0) return 0;
  return (watts * onHours) / 1000;
}

/** Cost in paise. Rounded to whole paise — money is never carried as a float here. */
export function estimateCostPaise(kwh: number, paisePerKwh: number): number {
  if (kwh <= 0 || paisePerKwh <= 0) return 0;
  return Math.round(kwh * paisePerKwh);
}

export type PowerEstimate = {
  onHours:      number;
  kwh:          number;
  costPaise:    number;
  watts:        number;
  paisePerKwh:  number;
  /** True when `watts` came from the fleet default rather than this store's own
   *  recorded figure — i.e. the estimate is a guess about the hardware. Surfaced so
   *  UIs can flag which stores need a real wattage before anyone trusts the number. */
  usingDefaultWatts: boolean;
  /** Where `watts` came from. `metered` (average draw the store's smart plug
   *  actually measured while on) beats `surveyed` (label-plate rating) beats
   *  `default` (fleet guess) — the socket knows better than the sticker. */
  source: 'metered' | 'surveyed' | 'default';
};

export function estimatePower(args: {
  buckets:     { totalMs: number }[];
  storeWatts:  number | null;
  defaultWatts: number;
  paisePerKwh: number;
  meteredWatts?: number | null;
}): PowerEstimate {
  const metered = args.meteredWatts != null && args.meteredWatts >= 1 ? args.meteredWatts : null;
  const watts   = metered ?? args.storeWatts ?? args.defaultWatts;
  const source  = metered != null ? 'metered' as const
    : args.storeWatts != null ? 'surveyed' as const : 'default' as const;
  const onHours = onHoursFromBuckets(args.buckets);
  const kwh     = estimateKwh(watts, onHours);
  return {
    onHours,
    kwh,
    costPaise: estimateCostPaise(kwh, args.paisePerKwh),
    watts,
    paisePerKwh: args.paisePerKwh,
    usingDefaultWatts: source === 'default',
    source,
  };
}

/** Start of the current IST month, as a UTC instant for querying. */
export function istMonthStart(now = new Date()): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}
