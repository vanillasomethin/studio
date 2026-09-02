// Slot-loop inventory core (see prisma SlotBooking block for the model).
//
// Semantics locked by the spec:
// - Availability(store, date) = loopSlotCount − COUNT(bookings) — SOLD bookings only.
//   Filler/bonus fill state must never surface as "sold out" to brands.
// - Playback never has dark slots: zero sales → whole loop plays the filler (house
//   ads) campaign; otherwise empty positions are round-robined across the sold
//   campaigns as bonus plays (isFiller=true, attributed to the campaign). If neither
//   sold creatives nor a filler exist the loop is empty, and /api/device/plan falls
//   back to schedule mode rather than serving an empty (dark) plan.
// - All dates are IST calendar dates; a store's open days are a Mon..Sun bitmask.

export const SLOT_DURATION_MS = 10_000;

// ── Slot spans (ads longer than one slot) ─────────────────────────────────────
//
// Every position is exactly 10 s and a loop of N positions is exactly N×10 s —
// that grid is the product brands buy, so it is never stretched. An ad longer
// than 10 s instead occupies several CONSECUTIVE positions: 30 s → 3 slots,
// 40 s → 4. Policy (user-approved 2026-09-02): round UP and hold — a 25 s ad
// books 3 slots and plays in a 30 s window (the player shows it in full; the
// remainder holds on the final frame once the APK honours durationMs for
// videos, and merely advances early until then). The ±0.49 s snap grace
// absorbs encoder drift: a "10-second" export of 10.3 s is still one slot,
// trimmed at the boundary rather than booking a second slot to hold a frozen
// frame for 9.7 s.

export const SLOT_SNAP_GRACE_MS = 490;

/** How many consecutive 10s positions a creative of this length occupies.
 *  Images and unknown durations count as one slot (they hold for the window). */
export function slotSpanForDuration(durationMs: number | null | undefined): number {
  if (!durationMs || durationMs <= 0) return 1;
  return Math.max(1, Math.ceil((durationMs - SLOT_SNAP_GRACE_MS) / SLOT_DURATION_MS));
}

export type SlotCreativeMeta = { contentId: string; durationMs: number | null; type?: string };

/**
 * The single span shared by all of a campaign's slot creatives, or a rejection.
 * Rotation swaps creatives into the same booked window, so a slot playlist
 * mixing a 10 s and a 30 s item has no honest span — reject at attach time.
 * Videos with unknown duration are rejected too: span cannot be derived, and
 * guessing 1 would silently truncate a longer ad.
 */
export function uniformSlotSpan(creatives: SlotCreativeMeta[]): { span: number } | { error: string } {
  if (creatives.length === 0) return { span: 1 };
  const unknown = creatives.filter((c) => c.type === 'VIDEO' && (!c.durationMs || c.durationMs <= 0));
  if (unknown.length > 0) {
    return { error: 'A video creative has no known duration — re-upload it so its length can be read' };
  }
  const spans = new Set(creatives.map((c) => slotSpanForDuration(c.durationMs)));
  if (spans.size > 1) {
    const classes = [...new Set(creatives.map((c) => `${slotSpanForDuration(c.durationMs) * 10}s`))].join(' and ');
    return { error: `All creatives in a slot rotation must be the same length class — this mixes ${classes}` };
  }
  return { span: [...spans][0] };
}

const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, no DST

/** Today's IST calendar date as 'YYYY-MM-DD'. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST weekday for a 'YYYY-MM-DD' date: 0=Mon … 6=Sun (matches the openDays bitmask). */
export function istWeekday(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return (jsDay + 6) % 7;
}

export function isOpenOn(openDays: number, dateStr: string): boolean {
  return (openDays & (1 << istWeekday(dateStr))) !== 0;
}

/** 'HH:mm' → minutes since midnight; null on malformed input. */
export function parseHHmm(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** How many times the full loop repeats across one open day (brand "guaranteed" math). */
export function loopRepeatsPerDay(store: {
  loopSlotCount: number; hoursStart: string; hoursEnd: string;
}): number {
  const start = parseHHmm(store.hoursStart) ?? 9 * 60;
  const end   = parseHHmm(store.hoursEnd)   ?? 21 * 60;
  const openSec = Math.max(0, end - start) * 60;
  const loopSec = store.loopSlotCount * (SLOT_DURATION_MS / 1000);
  return loopSec > 0 ? Math.floor(openSec / loopSec) : 0;
}

// ── Loop assembly ─────────────────────────────────────────────────────────────

export type SlotAssignment = {
  slotPosition: number;
  campaignId:   string;
  contentId:    string;      // the creative chosen for this position on this date
  isFiller:     boolean;     // true = bonus/house play in an unsold (or unplayable) position
  // How many consecutive positions this play occupies (1 = a plain 10s slot).
  // The wire durationMs is spanSlots × 10s; covered positions get no assignment.
  spanSlots:    number;
};

// A campaign's slot creatives in rotation order: the slot playlist's media items
// when one is attached, else the single slotContentId. Empty = sold but unplayable.
// spanId groups the rows of one multi-slot placement; creativeSpan is the span of
// the campaign's CURRENT creatives (bonus-pool eligibility — only 1-slot creatives
// can fill scattered single empties).
type BookingRow = {
  slotPosition: number;
  campaignId:   string;
  creativeIds:  string[];
  spanId?:      string | null;
  creativeSpan?: number;
};

/** Stable day number for a 'YYYY-MM-DD' date — the rotation offset that makes a
 *  single booked position show the NEXT playlist item each day. */
export function slotDayIndex(dateStr: string): number {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 86_400_000);
}

/** A campaign's candidate slot creatives. The slot playlist wins over the single
 *  creative; only its direct media items count (slot mode is a flat 10s loop, so
 *  nested-playlist items are ignored — pass them pre-filtered to contentId!=null). */
export function slotCreativeIds(campaign: {
  slotContentId: string | null;
  slotPlaylist?: { items: { contentId: string | null }[] } | null;
}): string[] {
  const fromPlaylist = (campaign.slotPlaylist?.items ?? [])
    .map((i) => i.contentId)
    .filter((id): id is string => id != null);
  if (fromPlaylist.length > 0) return fromPlaylist;
  return campaign.slotContentId ? [campaign.slotContentId] : [];
}

/**
 * Builds the playable loop for one store+date. Returns one assignment per position
 * that CAN play; positions with nothing playable anywhere (no sold creatives and no
 * filler creative) are omitted — the caller decides what an empty loop means.
 *
 * A booked campaign without any creative counts as SOLD for availability but
 * cannot render, so its positions join the redistribution set rather than going dark.
 *
 * Creative rotation: a campaign's k-th play of the day (bookings, bonus and filler
 * plays alike, in position order) shows creativeIds[(dayIndex + k) mod N]. With one
 * creative that degenerates to the old fixed behaviour; with a playlist, several
 * positions in one loop each show a different item, and a single position advances
 * one item per day. Deterministic per (date, bookings) — every plan fetch that day
 * builds the identical loop, so the plan hash still only rolls at IST midnight.
 *
 * `poolWeights` (campaignId -> extra pool entries) lets a campaign get a bigger share
 * of the round-robin bonus pool without a second scheduling engine — the mechanism
 * two different add-ons both reuse:
 *   - Minimum Play Guarantee makegood (lib/sla.ts): a campaign owed a shortfall makegood
 *     gets extra entries until it's paid down — "carried forward and added to next
 *     cycle's rotation, on top of normal quota".
 *   - Peak Boost (lib/addons.ts): a boosted campaign gets extra entries during peak
 *     windows only — the caller is responsible for zeroing this out outside a window.
 * Callers merge both sources into one map before calling. Empty/omitted = today's
 * plain round-robin, unchanged. Weighted bonus plays advance the campaign's creative
 * rotation like any other play, so a boosted playlist campaign spreads its items.
 */
export function buildSlotLoop(
  loopSlotCount: number,
  bookings: BookingRow[],
  filler: { campaignId: string; creativeIds: string[] } | null,
  dayIndex = 0,
  poolWeights: Map<string, number> = new Map(),
): SlotAssignment[] {
  const inRange = bookings.filter((b) => b.slotPosition >= 0 && b.slotPosition < loopSlotCount);

  // Group multi-slot placements: rows sharing a spanId are ONE play whose window
  // is rowCount × 10s at the group's lowest position. The group is what was sold,
  // so it keeps its window even if the campaign's creative was swapped since.
  // Positions of non-head members are consumed — never bonus/filler-filled.
  type Group = { head: number; span: number; row: BookingRow };
  const groups: Group[] = [];
  const bySpan = new Map<string, BookingRow[]>();
  for (const b of inRange) {
    if (!b.spanId) { groups.push({ head: b.slotPosition, span: 1, row: b }); continue; }
    const list = bySpan.get(b.spanId) ?? [];
    list.push(b);
    bySpan.set(b.spanId, list);
  }
  for (const rows of bySpan.values()) {
    const head = Math.min(...rows.map((r) => r.slotPosition));
    groups.push({ head, span: rows.length, row: rows.find((r) => r.slotPosition === head)! });
  }

  // Positions consumed by a PLAYABLE multi-slot window (head included): the whole
  // window belongs to that placement. An UNPLAYABLE group (sold but no creative)
  // keeps the old single-slot semantics instead — every one of its positions joins
  // the redistribution set, because a window that cannot render must not go dark.
  const headByPosition = new Map<number, Group>();
  const consumed = new Set<number>();
  for (const g of groups) {
    headByPosition.set(g.head, g);
    if (g.span > 1 && g.row.creativeIds.length > 0) {
      for (const r of bySpan.get(g.row.spanId!) ?? []) consumed.add(r.slotPosition);
    }
  }

  const played = new Map<string, number>();
  const nextCreative = (campaignId: string, ids: string[]): string => {
    const k = played.get(campaignId) ?? 0;
    played.set(campaignId, k + 1);
    return ids[(dayIndex + k) % ids.length];
  };

  // Playable sold campaigns in first-appearance (position) order — the round-robin pool.
  // A campaign with extra pool weight (makegood and/or Peak Boost) gets extra entries,
  // biasing the round-robin selection below in its favour without changing eligibility.
  // Multi-slot campaigns are excluded: a 30s creative cannot fill one scattered empty
  // 10s position, so bonus fill (and therefore makegood/Peak Boost weighting) is a
  // single-slot mechanism by construction.
  const pool: { campaignId: string; creativeIds: string[] }[] = [];
  const seen = new Set<string>();
  for (let pos = 0; pos < loopSlotCount; pos++) {
    const g = headByPosition.get(pos);
    const b = g?.row;
    if (b && b.creativeIds.length > 0 && (b.creativeSpan ?? 1) === 1 && g!.span === 1 && !seen.has(b.campaignId)) {
      seen.add(b.campaignId);
      const copies = 1 + Math.max(0, poolWeights.get(b.campaignId) ?? 0);
      for (let i = 0; i < copies; i++) pool.push({ campaignId: b.campaignId, creativeIds: b.creativeIds });
    }
  }

  const out: SlotAssignment[] = [];
  let rr = 0;
  const playableFiller = filler && filler.creativeIds.length > 0 ? filler : null;
  for (let pos = 0; pos < loopSlotCount; pos++) {
    const g = headByPosition.get(pos);
    if (g && g.row.creativeIds.length > 0) {
      out.push({
        slotPosition: pos,
        campaignId:   g.row.campaignId,
        contentId:    nextCreative(g.row.campaignId, g.row.creativeIds),
        isFiller:     false,
        spanSlots:    g.span,
      });
    } else if (consumed.has(pos)) {
      // A member of a multi-slot placement (or an unplayable head) — the window
      // belongs to that placement; never redistribute it.
      continue;
    } else if (pool.length > 0) {
      const p = pool[rr++ % pool.length]; // bonus play for a sold campaign
      out.push({ slotPosition: pos, campaignId: p.campaignId, contentId: nextCreative(p.campaignId, p.creativeIds), isFiller: true, spanSlots: 1 });
    } else if (playableFiller) {
      out.push({ slotPosition: pos, campaignId: playableFiller.campaignId, contentId: nextCreative(playableFiller.campaignId, playableFiller.creativeIds), isFiller: true, spanSlots: 1 });
    }
    // else: nothing playable exists — position omitted
  }
  return out;
}
