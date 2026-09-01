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
};

// A campaign's slot creatives in rotation order: the slot playlist's media items
// when one is attached, else the single slotContentId. Empty = sold but unplayable.
type BookingRow = { slotPosition: number; campaignId: string; creativeIds: string[] };

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
  const byPosition = new Map<number, BookingRow>();
  for (const b of bookings) {
    if (b.slotPosition >= 0 && b.slotPosition < loopSlotCount) byPosition.set(b.slotPosition, b);
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
  const pool: { campaignId: string; creativeIds: string[] }[] = [];
  const seen = new Set<string>();
  for (let pos = 0; pos < loopSlotCount; pos++) {
    const b = byPosition.get(pos);
    if (b && b.creativeIds.length > 0 && !seen.has(b.campaignId)) {
      seen.add(b.campaignId);
      const copies = 1 + Math.max(0, poolWeights.get(b.campaignId) ?? 0);
      for (let i = 0; i < copies; i++) pool.push({ campaignId: b.campaignId, creativeIds: b.creativeIds });
    }
  }

  const out: SlotAssignment[] = [];
  let rr = 0;
  const playableFiller = filler && filler.creativeIds.length > 0 ? filler : null;
  for (let pos = 0; pos < loopSlotCount; pos++) {
    const b = byPosition.get(pos);
    if (b && b.creativeIds.length > 0) {
      out.push({ slotPosition: pos, campaignId: b.campaignId, contentId: nextCreative(b.campaignId, b.creativeIds), isFiller: false });
    } else if (pool.length > 0) {
      const p = pool[rr++ % pool.length]; // bonus play for a sold campaign
      out.push({ slotPosition: pos, campaignId: p.campaignId, contentId: nextCreative(p.campaignId, p.creativeIds), isFiller: true });
    } else if (playableFiller) {
      out.push({ slotPosition: pos, campaignId: playableFiller.campaignId, contentId: nextCreative(playableFiller.campaignId, playableFiller.creativeIds), isFiller: true });
    }
    // else: nothing playable exists — position omitted
  }
  return out;
}
