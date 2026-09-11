// Should this video be retimed to land exactly on a slot boundary?
//
// The slot grid is fixed: every position is 10 s, and an ad longer than that occupies
// several CONSECUTIVE positions (see src/lib/slots.ts). SLOT_SNAP_GRACE_MS absorbs
// encoder drift, so the real cliff is at 10.50 s, not 10.00 s — a 10.49 s export is one
// slot, and a 10.51 s export is two. That second slot is not a rounding detail: the
// brand pays double, and ~9.5 s of the 20 s window holds a frozen final frame.
//
// So a video overshooting a slot multiple by a small margin is retimed during transcode
// to land on the multiple. Ruling (2026-09-09): band 1.0 s, automatic, with a visible
// badge on the Content row.
//
// Why retime rather than trim the tail: the end card — logo, CTA, the offer — lives in
// the last second. Trimming cuts exactly what the brand is paying to show. Under ~10%
// the retime is imperceptible, and atempo preserves pitch so the voiceover does not
// turn into a chipmunk.
//
// Why not simply widen SLOT_SNAP_GRACE_MS to 1500 — a one-constant fix — is that the
// player TRUNCATES at the slot boundary rather than fitting, so a wider grace silently
// cuts the same end card while also making the "10 seconds" product claim mushy.
// Rejected 2026-09-09; do not re-propose.
//
// Split out of index.mjs so it can be exercised without the ffmpeg/ffprobe installer
// packages, exactly like conformance.mjs. Keep this file dependency-free — the
// Dockerfile COPYs it alongside index.mjs and scripts/verify-speed-fit.mjs imports it.

// Mirrors of src/lib/slots.ts. Duplicated because the Lambda cannot import TypeScript
// through a '@/' alias, which is the same reason conformance.mjs and store-ids.ts stand
// alone. scripts/verify-speed-fit.mjs imports BOTH this file and src/lib/slots.ts and
// fails if they ever disagree, so the copy cannot drift silently.
export const SLOT_DURATION_MS   = 10_000;
export const SLOT_SNAP_GRACE_MS = 490;

/** The widest overshoot worth retiming. Above this the clip is not drift — it is a
 *  genuinely longer ad that should honestly book the slots it needs. A 25 s creative
 *  overshoots 20 s by 5 s and must stay a 3-slot ad, not be sped up 25%. */
export const MAX_SPEED_FIT_MS = 1_000;

/** How many consecutive 10 s positions a creative of this length occupies. */
export function slotSpan(durationMs) {
  if (!durationMs || durationMs <= 0) return 1;
  return Math.max(1, Math.ceil((durationMs - SLOT_SNAP_GRACE_MS) / SLOT_DURATION_MS));
}

/**
 * Decide whether to retime, and by how much.
 *
 * The target is always the slot multiple BELOW the one this duration currently books:
 * a clip that just tipped into N slots is pulled back to N-1 slots' worth of time.
 *
 *   10.50 s → 10.0 s  (5% faster — the cliff itself)
 *   10.90 s → 10.0 s  (9%)
 *   30.60 s → 30.0 s  (2%)
 *   11.20 s → refused (1.2 s over; it books two slots honestly)
 *   20.00 s → refused (a real 20 s ad is exactly 2 slots, nothing to fix)
 *   10.40 s → refused (already one slot — the grace covers it)
 *
 * @param durationMs source duration in ms, or null/0 when unknown
 * @returns {{fit:false, reason:string}|{fit:true, targetMs:number, rate:number, overshootMs:number}}
 */
export function planSpeedFit(durationMs) {
  if (!durationMs || durationMs <= 0) return { fit: false, reason: 'unknown-duration' };

  const span = slotSpan(durationMs);
  // One slot already: the grace has absorbed whatever drift there is, and there is no
  // lower multiple to pull back to. Speeding a 9.8 s clip up to nothing is meaningless.
  if (span < 2) return { fit: false, reason: 'already-one-slot' };

  const targetMs    = (span - 1) * SLOT_DURATION_MS;
  const overshootMs = durationMs - targetMs;
  if (overshootMs > MAX_SPEED_FIT_MS) return { fit: false, reason: 'overshoot-too-large' };

  // rate > 1 means "play faster". Bounded by construction: overshoot <= 1000 ms and
  // target >= 10000 ms, so rate <= 1.1 — comfortably inside atempo's accepted range,
  // and inside the ~10% at which a retime stops being imperceptible.
  const rate = durationMs / targetMs;
  return { fit: true, targetMs, rate, overshootMs };
}

/** ffmpeg filter fragments for a plan. Video and audio are retimed by the SAME factor,
 *  so they cannot drift apart; atempo is what keeps pitch intact. Returns null when
 *  there is nothing to do, so callers can leave their filter chain untouched. */
export function speedFitFilters(plan) {
  if (!plan?.fit) return null;
  // Six decimals: the residual error is well under one frame at 30fps, and far inside
  // the snap grace that decides the slot count in the first place.
  const r = plan.rate.toFixed(6);
  return { videoFilter: `setpts=PTS/${r}`, audioFilter: `atempo=${r}` };
}
