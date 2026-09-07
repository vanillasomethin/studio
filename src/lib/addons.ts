// Peak Boost / Sound Ad add-ons — pure math. DB-bound counterpart: addons-db.ts.
//
// Both are flags on an existing slot booking, not new slot types (spec: "no new
// rotation engine needed"). Peak Boost reuses the same round-robin pool-weighting
// mechanism buildSlotLoop already has for Minimum Play Guarantee makegood (lib/slots.ts);
// Sound Ad is a single designated loop position, gated player-side (once/hour, mute
// override) rather than server-side, since the server only sends one loop pass per
// plan fetch and can't know "the top of the hour" for a pass that gets replayed all day.

export const PEAK_BOOST_CAP = 4; // half of the base 8-slot cap
export const SOUND_AD_CAP = 1; // not per brand — one sound-enabled slot per screen

// Extra round-robin pool entries a Peak-Boosted campaign gets during a peak window —
// 3 total copies (1 base + 2 extra) = 3x insertion frequency, the top of the spec's
// "2-3x" range. Outside peak windows this contributes 0 (plain round-robin).
export const PEAK_BOOST_EXTRA_WEIGHT = 2;

// IST minutes-since-midnight. Matches lib/slots.ts's IST day convention.
export const PEAK_WINDOWS = [
  { id: '1A', startMin: 9 * 60,        endMin: 11 * 60       }, // 9:00–11:00
  { id: '2A', startMin: 12 * 60 + 30,  endMin: 14 * 60 + 30  }, // 12:30–14:30
  { id: '3B', startMin: 17 * 60 + 30,  endMin: 19 * 60 + 30  }, // 17:30–19:30
  { id: '3C', startMin: 19 * 60 + 30,  endMin: 21 * 60 + 30  }, // 19:30–21:30
] as const;

const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, no DST

/** Minutes since IST midnight for an instant. */
export function istMinutesOfDay(now: Date = new Date()): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function activePeakWindowId(minutesOfDay: number): string | null {
  return PEAK_WINDOWS.find((w) => minutesOfDay >= w.startMin && minutesOfDay < w.endMin)?.id ?? null;
}

export function isPeakWindowNow(now: Date = new Date()): boolean {
  return activePeakWindowId(istMinutesOfDay(now)) !== null;
}

export type AddonType = 'peak_boost' | 'sound_ad';
export type AddonStatus = 'active' | 'waitlisted';

export function addonCap(type: AddonType): number {
  return type === 'peak_boost' ? PEAK_BOOST_CAP : SOUND_AD_CAP;
}

/** First-come-first-served: active while under cap, waitlisted beyond it. Pure
 *  decision given the count of already-active add-ons of this type at the store. */
export function decideAddonStatus(activeCount: number, type: AddonType): AddonStatus {
  return activeCount < addonCap(type) ? 'active' : 'waitlisted';
}

/** Round-robin pool weight for a Peak-Boosted campaign right now — 0 outside a peak
 *  window (spec: "revert to normal round-robin, no boost"), PEAK_BOOST_EXTRA_WEIGHT
 *  inside one. Combines additively with any Minimum Play Guarantee makegood weight
 *  the same campaign might also hold (see buildSlotLoop's poolWeights param). */
export function peakBoostPoolWeights(boostedCampaignIds: Iterable<string>, inPeakWindow: boolean): Map<string, number> {
  const weights = new Map<string, number>();
  if (!inPeakWindow) return weights;
  for (const id of boostedCampaignIds) weights.set(id, PEAK_BOOST_EXTRA_WEIGHT);
  return weights;
}
