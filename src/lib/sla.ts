// Minimum Play Guarantee (SLA) — pure math. DB-bound counterpart: sla-db.ts.
//
// A "cycle" is one calendar month of a campaign's flight, checked once it has fully
// elapsed (spec: "checked at end of billing cycle, not daily"). For each closed cycle:
//   shortfallPlays = max(0, promised − delivered)
//   remedy = makegood (default) if a later cycle exists to carry the shortfall into,
//            else credit (pro-rated bill credit) — never both for the same shortfall.
//
// Dates are UTC-midnight day boundaries, matching SlotBooking.date's existing
// convention (a DATE column stamped from the IST calendar date — see lib/slots.ts
// istToday()). Cycle math below stays in that same "day, not instant" precision;
// campaign.startDate's exact time-of-day is not meaningful here.

export const MAX_MAKEGOOD_WEIGHT = 3;

function dateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function cycleBounds(startDate: Date, cycleIndex: number): { cycleStart: Date; cycleEnd: Date } {
  const base = dateOnlyUTC(startDate);
  const cycleStart = new Date(base);
  cycleStart.setUTCMonth(cycleStart.getUTCMonth() + cycleIndex);
  const cycleEnd = new Date(base);
  cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + cycleIndex + 1);
  return { cycleStart, cycleEnd };
}

export function computeShortfall(promisedPlays: number, deliveredPlays: number): number {
  return Math.max(0, promisedPlays - deliveredPlays);
}

/** No dual remedy: makegood when a later cycle exists to carry the shortfall into,
 *  credit only as the fallback when there isn't (e.g. the campaign's final cycle). */
export function decideRemedy(args: { hasNextCycle: boolean }): 'makegood' | 'credit' {
  return args.hasNextCycle ? 'makegood' : 'credit';
}

/** Pro-rated against the unpaid shortfall % of the cycle's price, rounded to the
 *  nearest rupee (Campaign.pricePerScreen/totalAmount are whole-rupee figures). */
export function proRatedCredit(args: {
  shortfallPlays: number;
  promisedPlays: number;
  cyclePriceRupees: number;
}): number {
  if (args.promisedPlays <= 0) return 0;
  const pct = Math.min(1, args.shortfallPlays / args.promisedPlays);
  return Math.round(pct * args.cyclePriceRupees);
}

export type GuaranteeCycleResult = {
  cycleIndex: number;
  cycleStart: Date;
  cycleEnd: Date;
  promisedPlays: number;
  deliveredPlays: number;
  shortfallPlays: number;
  remedyType: 'makegood' | 'credit' | null;
  makegoodBalance: number;
  creditAmount: number;
};

/** Pure decision step for one closed cycle, given its promised/delivered totals. */
export function evaluateCycle(args: {
  cycleIndex: number;
  cycleStart: Date;
  cycleEnd: Date;
  promisedPlays: number;
  deliveredPlays: number;
  hasNextCycle: boolean;
  cyclePriceRupees: number;
}): GuaranteeCycleResult {
  const shortfallPlays = computeShortfall(args.promisedPlays, args.deliveredPlays);
  if (shortfallPlays === 0) {
    return {
      cycleIndex: args.cycleIndex, cycleStart: args.cycleStart, cycleEnd: args.cycleEnd,
      promisedPlays: args.promisedPlays, deliveredPlays: args.deliveredPlays,
      shortfallPlays: 0, remedyType: null, makegoodBalance: 0, creditAmount: 0,
    };
  }
  const remedyType = decideRemedy({ hasNextCycle: args.hasNextCycle });
  return {
    cycleIndex: args.cycleIndex, cycleStart: args.cycleStart, cycleEnd: args.cycleEnd,
    promisedPlays: args.promisedPlays, deliveredPlays: args.deliveredPlays,
    shortfallPlays, remedyType,
    makegoodBalance: remedyType === 'makegood' ? shortfallPlays : 0,
    creditAmount: remedyType === 'credit'
      ? proRatedCredit({ shortfallPlays, promisedPlays: args.promisedPlays, cyclePriceRupees: args.cyclePriceRupees })
      : 0,
  };
}

/** Remaining makegood weight for the round-robin bonus pool (lib/slots.ts
 *  buildSlotLoop): total granted minus bonus plays already delivered since the
 *  earliest still-active grant, capped so one campaign can't monopolise a store's
 *  unsold positions. */
export function remainingMakegoodWeight(totalGranted: number, deliveredSinceGrant: number): number {
  return Math.min(MAX_MAKEGOOD_WEIGHT, Math.max(0, totalGranted - deliveredSinceGrant));
}
