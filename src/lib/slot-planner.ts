// The bulk slot-booking planner: who gets which loop positions, and what was missed.
//
// Lifted out of POST /api/slots/bookings/bulk so the selling rules can be exercised
// directly. The route still owns auth, validation, the two queries and the insert
// transaction; everything between "here is the matrix" and "here are the rows to
// write" lives here, as pure math over plain values.
//
// Three allocation shapes, one output:
//   auto     — book `slotsPerDay` plays into the lowest free runs of `span` positions.
//   manual   — the operator named the head position of each play; no substitution.
//   copy-day — replicate one store-day's placements, whole windows or not at all.
//
// Policy (deliberate, shared by all three): book what fits and report the gaps.
// Nothing already sold is ever overwritten, and a play by the same campaign that is
// already in place counts toward the target, so re-running a request is idempotent.
// Counters are in PLAYS; a play is `span` consecutive rows that must land together.

// Explicit .ts extension (tsconfig sets allowImportingTsExtensions) so the verify
// script can import this module straight into Node's type-stripping loader, which
// does no extensionless resolution. The bundler resolves it either way.
import { isOpenOn } from './slots.ts';

export type PlannerStore = {
  id: string;
  storeName: string;
  loopSlotCount: number;
  openDays: number;
};

/** One already-booked row, as read back from SlotBooking. */
export type ExistingRow = {
  storeId: string;
  date: string;            // YYYY-MM-DD
  slotPosition: number;
  campaignId: string;
  spanId: string | null;   // null for legacy single-slot rows
};

/** One placement on the source day of a copy-day, as a unit that moves together. */
export type CopyUnit = { positions: number[]; campaignId: string; span: number };

export type PlannerMode =
  | { kind: 'auto';     campaignId: string; span: number; slotsPerDay: number }
  | { kind: 'manual';   campaignId: string; span: number; positions: number[] }
  | { kind: 'copy-day'; units: CopyUnit[]; sourceStoreId: string; sourceDate: string };

/** A planned play: the row set that must land together (1 row for a 10s ad). */
export type PlannedPlay = {
  storeId: string;
  date: string;
  positions: number[];
  campaignId: string;
  spanId: string | null;   // null for single-slot plays (legacy row shape)
};

export type PlannerGap = {
  storeId: string;
  storeName: string;
  date: string;
  missed: number;
  reason: 'full' | 'partial';
};

export type PlannerResult = {
  plays: PlannedPlay[];
  gaps: PlannerGap[];
  requested: number;
  alreadySatisfied: number;
  closedSkipped: number;
};

type TakenRow = { campaignId: string; spanId: string | null };

/**
 * A multi-slot ad asked for positions 4 and 5 would have its two windows overlap
 * (4,5,6 and 5,6,7). Refuse up front — silently dropping the second play would look
 * like an availability problem that ops cannot find.
 *
 * `positions` must already be ascending and de-duplicated.
 * Returns the operator-facing sentence, or null when the picks are spaced legally.
 */
export function positionOverlapError(positions: number[], span: number): string | null {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < span) {
      return `This campaign occupies ${span} consecutive slots per play, so chosen positions must be at least ${span} apart — ${positions[i - 1] + 1} and ${positions[i] + 1} overlap`;
    }
  }
  return null;
}

/**
 * Does a run of the same campaign across `holders` count as the play we were asked
 * for? Only when it is ONE placement: same-campaign scattered single rows are not
 * the 30s window, and passing them would report a booking that does not exist.
 */
function isSamePlay(holders: (TakenRow | undefined)[], campaignId: string, span: number): boolean {
  if (!holders.every((h) => h?.campaignId === campaignId)) return false;
  if (span === 1) return true;
  const spanIds = new Set(holders.map((h) => h!.spanId));
  return spanIds.size === 1 && !spanIds.has(null);
}

/**
 * Plan a bulk booking over stores × dates.
 *
 * `newSpanId` is injectable so a caller can plan deterministically; it defaults to
 * a random UUID, which is what the route wants for real rows.
 */
export function planBulkBookings(input: {
  stores: PlannerStore[];
  dates: string[];
  existing: ExistingRow[];
  mode: PlannerMode;
  newSpanId?: () => string;
}): PlannerResult {
  const { stores, dates, existing, mode } = input;
  const newSpanId = input.newSpanId ?? (() => globalThis.crypto.randomUUID());

  const takenByCell = new Map<string, Map<number, TakenRow>>(); // storeId|date → position → holder
  for (const b of existing) {
    const key = `${b.storeId}|${b.date}`;
    const cell = takenByCell.get(key) ?? new Map<number, TakenRow>();
    cell.set(b.slotPosition, { campaignId: b.campaignId, spanId: b.spanId });
    takenByCell.set(key, cell);
  }

  const plays: PlannedPlay[] = [];
  const gaps: PlannerGap[] = [];
  let requested = 0, alreadySatisfied = 0, closedSkipped = 0;

  for (const store of stores) {
    const loopSlotCount = store.loopSlotCount;
    for (const date of dates) {
      if (mode.kind === 'copy-day' && store.id === mode.sourceStoreId && date === mode.sourceDate) continue;
      if (!isOpenOn(store.openDays, date)) { closedSkipped++; continue; }

      const taken = takenByCell.get(`${store.id}|${date}`) ?? new Map<number, TakenRow>();
      let bookedHere = 0, missedHere = 0;

      const place = (positions: number[], campaignId: string, span: number) => {
        const spanId = span > 1 ? newSpanId() : null;
        plays.push({ storeId: store.id, date, positions, campaignId, spanId });
        for (const p of positions) taken.set(p, { campaignId, spanId: 'planned' });
        bookedHere++;
      };

      if (mode.kind === 'copy-day') {
        requested += mode.units.length;
        for (const unit of mode.units) {
          if (unit.positions[unit.positions.length - 1] >= loopSlotCount) { missedHere++; continue; }
          const holders = unit.positions.map((p) => taken.get(p));
          if (holders.every((h) => h?.campaignId === unit.campaignId)) {
            if (isSamePlay(holders, unit.campaignId, unit.span)) { alreadySatisfied++; continue; }
            missedHere++; continue;
          }
          if (holders.some((h) => h !== undefined)) { missedHere++; continue; }
          place(unit.positions, unit.campaignId, unit.span);
        }
      } else if (mode.kind === 'manual') {
        // Each chosen position is the head of one play. No searching, no substituting
        // a nearby free run — the operator picked these positions and a silent move
        // is a booking they didn't make.
        requested += mode.positions.length;
        for (const head of mode.positions) {
          if (head + mode.span > loopSlotCount) { missedHere++; continue; }
          const positions = Array.from({ length: mode.span }, (_, i) => head + i);
          const holders = positions.map((p) => taken.get(p));
          if (holders.every((h) => h?.campaignId === mode.campaignId)) {
            if (isSamePlay(holders, mode.campaignId, mode.span)) { alreadySatisfied++; continue; }
            missedHere++; continue;
          }
          if (holders.some((h) => h !== undefined)) { missedHere++; continue; }
          place(positions, mode.campaignId, mode.span);
        }
      } else {
        requested += mode.slotsPerDay;
        // Existing plays by this campaign count toward the daily target: one play
        // per span group plus one per legacy single row.
        const mySpanIds = new Set<string>();
        let myPlays = 0;
        for (const [pos, holder] of taken) {
          if (holder.campaignId !== mode.campaignId || pos >= loopSlotCount) continue;
          if (holder.spanId) {
            if (!mySpanIds.has(holder.spanId)) { mySpanIds.add(holder.spanId); myPlays++; }
          } else {
            myPlays++;
          }
        }
        const already = Math.min(myPlays, mode.slotsPerDay);
        alreadySatisfied += already;
        let want = mode.slotsPerDay - already;

        // Lowest-first run allocation: place each play at the first run of
        // `span` consecutive free positions.
        for (let pos = 0; pos + mode.span <= loopSlotCount && want > 0; pos++) {
          let fits = true;
          for (let i = 0; i < mode.span; i++) {
            if (taken.has(pos + i)) { fits = false; break; }
          }
          if (!fits) continue;
          place(Array.from({ length: mode.span }, (_, i) => pos + i), mode.campaignId, mode.span);
          want--;
          pos += mode.span - 1;
        }
        missedHere = want;
      }

      if (missedHere > 0) {
        gaps.push({
          storeId: store.id, storeName: store.storeName, date,
          missed: missedHere, reason: bookedHere === 0 ? 'full' : 'partial',
        });
      }
    }
  }

  return { plays, gaps, requested, alreadySatisfied, closedSkipped };
}
