// Verifies the slot speed-fit rule in transcode-lambda/speed-fit.mjs — which videos get
// retimed onto a slot boundary during transcode, and by how much.
//
// Run: npm run verify:speed-fit   (exits non-zero on failure)
//
// Three parts:
//   1. The decision table — the cases the ruling was written against.
//   2. A DRIFT GUARD. speed-fit.mjs re-implements slotSpanForDuration() because the
//      Lambda cannot import TypeScript through a '@/' alias. That copy is the one real
//      hazard in this feature: if SLOT_SNAP_GRACE_MS ever moves in src/lib/slots.ts and
//      the Lambda keeps the old number, creatives get fitted to a boundary the booking
//      engine does not agree is a boundary. So both are imported here and swept against
//      each other, rather than trusted to stay in sync by good intentions.
//   3. Invariants that must hold for EVERY duration, not just the tabulated ones —
//      chiefly that a fit always lands the clip one slot cheaper and never speeds it up
//      by more than the band allows.

import {
  planSpeedFit, slotSpan, speedFitFilters,
  SLOT_DURATION_MS, SLOT_SNAP_GRACE_MS, MAX_SPEED_FIT_MS,
} from '../transcode-lambda/speed-fit.mjs';
import {
  slotSpanForDuration, describeSlotFit, slotFitMessage,
  planSpeedFit as tsPlanSpeedFit,
  SLOT_DURATION_MS as TS_SLOT_MS,
  SLOT_SNAP_GRACE_MS as TS_GRACE_MS,
  MAX_SPEED_FIT_MS as TS_BAND_MS,
} from '../src/lib/slots.ts';

let failures = 0;
let checks = 0;
const eq = (name, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};
const ok = (name, cond) => { checks++; if (!cond) { failures++; console.error(`  FAIL ${name}`); } };

// ── 1. The decision table ────────────────────────────────────────────────────
console.log('planSpeedFit — the cases the ruling names');

const verdict = (ms) => { const p = planSpeedFit(ms); return p.fit ? `fit->${p.targetMs}` : p.reason; };

// The cliff itself. 10.49 s is still one slot (the grace covers it); 10.50 s tips into
// two and is exactly what this feature exists to pull back.
eq('9 800 ms — comfortably one slot',        verdict(9_800),  'already-one-slot');
eq('10 000 ms — exactly one slot',           verdict(10_000), 'already-one-slot');
eq('10 490 ms — last ms the grace absorbs',  verdict(10_490), 'already-one-slot');
eq('10 500 ms — the cliff, fitted',          verdict(10_500), 'fit->10000');
eq('10 600 ms — fitted',                     verdict(10_600), 'fit->10000');
eq('10 900 ms — widest fittable overshoot',  verdict(10_900), 'fit->10000');
eq('11 000 ms — exactly the band, fitted',   verdict(11_000), 'fit->10000');
eq('11 200 ms — past the band, left alone',  verdict(11_200), 'overshoot-too-large');

// A genuinely longer ad must book the slots it needs — the band is for drift, not for
// squeezing a 25 s film into 20 s.
eq('20 000 ms — a real two-slot ad',         verdict(20_000), 'overshoot-too-large');
eq('25 000 ms — a real 25 s ad',             verdict(25_000), 'overshoot-too-large');
eq('30 600 ms — drift on a 30 s ad, fitted', verdict(30_600), 'fit->30000');
eq('30 000 ms — exactly three slots',        verdict(30_000), 'overshoot-too-large');

// Unknown/absent duration must never produce a filter — an ffmpeg arg built from NaN
// would fail the whole transcode.
eq('null duration',      verdict(null),  'unknown-duration');
eq('zero duration',      verdict(0),     'unknown-duration');
eq('negative duration',  verdict(-5),    'unknown-duration');
eq('no filters when not fitting', speedFitFilters(planSpeedFit(20_000)), null);
eq('no filters for unknown duration', speedFitFilters(planSpeedFit(null)), null);

// The rate is what ffmpeg is handed; a wrong one silently ships a wrong-length ad.
{
  const p = planSpeedFit(10_500);
  eq('10 500 ms rate', p.rate, 1.05);
  eq('10 500 ms overshoot', p.overshootMs, 500);
  const f = speedFitFilters(p);
  eq('10 500 ms filters', f, { videoFilter: 'setpts=PTS/1.050000', audioFilter: 'atempo=1.050000' });
}
{
  const f = speedFitFilters(planSpeedFit(30_600));
  eq('30 600 ms filters', f, { videoFilter: 'setpts=PTS/1.020000', audioFilter: 'atempo=1.020000' });
}

// ── 2. Drift guard against src/lib/slots.ts ──────────────────────────────────
console.log('speed-fit.mjs vs src/lib/slots.ts — the duplicated span rule');

eq('SLOT_DURATION_MS agrees',   SLOT_DURATION_MS,   TS_SLOT_MS);
eq('SLOT_SNAP_GRACE_MS agrees', SLOT_SNAP_GRACE_MS, TS_GRACE_MS);
eq('MAX_SPEED_FIT_MS agrees',   MAX_SPEED_FIT_MS,   TS_BAND_MS);

// The WHOLE plan, not just the span it is derived from. The studio now shows an
// uploader what the pipeline will do to their file, so a disagreement here means the
// console promises one thing and the Lambda does another — silently, and only visible
// once someone compares a badge against an invoice.
{
  let mismatch = null;
  for (let ms = 0; ms <= 55_000; ms += 10) {
    const a = JSON.stringify(planSpeedFit(ms));
    const b = JSON.stringify(tsPlanSpeedFit(ms));
    if (a !== b) { mismatch = { ms, lambda: a, studio: b }; break; }
  }
  eq('planSpeedFit matches at every 10 ms from 0 to 55 s', mismatch, null);
  for (const ms of [null, undefined, 0, -1]) {
    ok(`plan agrees on ${String(ms)}`, JSON.stringify(planSpeedFit(ms)) === JSON.stringify(tsPlanSpeedFit(ms)));
  }
}

// ── The upload-time verdict ──────────────────────────────────────────────────
console.log('describeSlotFit — what the uploader is told');

const kindOf = (ms) => describeSlotFit(ms).kind;
eq('9 800 ms reads as exact',       kindOf(9_800),  'exact');
eq('10 490 ms reads as exact',      kindOf(10_490), 'exact');
eq('10 500 ms reads as fitted',     kindOf(10_500), 'fitted');
eq('10 900 ms reads as fitted',     kindOf(10_900), 'fitted');
eq('11 200 ms reads as spans',      kindOf(11_200), 'spans');
eq('20 000 ms reads as spans',      kindOf(20_000), 'spans');
eq('25 000 ms reads as spans',      kindOf(25_000), 'spans');
eq('30 600 ms reads as fitted',     kindOf(30_600), 'fitted');
eq('null reads as unknown',         kindOf(null),   'unknown');
eq('0 reads as unknown',            kindOf(0),      'unknown');

// The counts shown to the uploader are what they get BILLED for, so they have to be the
// post-pipeline truth, not the pre-transcode one.
eq('10 600 ms is billed as 1 slot after the fit', describeSlotFit(10_600).slots, 1);
eq('30 600 ms is billed as 3 slots after the fit', describeSlotFit(30_600).slots, 3);
eq('11 200 ms is billed as 2 slots',              describeSlotFit(11_200).slots, 2);
eq('25 000 ms is billed as 3 slots',              describeSlotFit(25_000).slots, 3);
eq('11 200 ms wastes 8 800 ms of its window',     describeSlotFit(11_200).wastedMs, 8_800);

// The sentence itself, in full. These numbers are what a brand gets billed, so a typo
// or an off-by-one in the copy is a wrong promise, not a cosmetic slip.
eq('exact copy',
  slotFitMessage(9_800),
  { tone: 'info', text: 'Fits one 10s slot.' });
eq('fitted copy',
  slotFitMessage(10_600),
  { tone: 'info', text: '10.6s — will be sped up 6% to 10s so it still books 1 slot. The original is kept.' });
eq('fitted copy, multi-slot',
  slotFitMessage(30_600),
  { tone: 'info', text: '30.6s — will be sped up 2% to 30s so it still books 3 slots. The original is kept.' });
eq('spans copy',
  slotFitMessage(11_200),
  { tone: 'warn', text: '11.2s — books 2 slots (20s) and pays for all of them, holding a frozen frame for the spare 8.8s. Trim to 10s to book one fewer.' });
eq('spans copy, longer',
  slotFitMessage(25_000),
  { tone: 'warn', text: '25s — books 3 slots (30s) and pays for all of them, holding a frozen frame for the spare 5s. Trim to 20s to book one fewer.' });
eq('unknown copy tone', slotFitMessage(null).tone, 'warn');

// The advice has to be actionable: trimming to the suggested length must genuinely
// drop a slot, for every spanning duration.
{
  let broke = null;
  for (let ms = 10_501; ms <= 60_000; ms += 1) {
    const v = describeSlotFit(ms);
    if (v.kind !== 'spans') continue;
    const suggested = (v.slots - 1) * 10_000;
    if (slotSpanForDuration(suggested) !== v.slots - 1) broke ??= ms;
  }
  eq('the suggested trim length really does book one slot fewer', broke, null);
}

// The verdict must never contradict the engine that does the billing: whatever the
// uploader is told, that is the span the loop builder will charge for.
{
  let broke = null;
  for (let ms = 1; ms <= 60_000; ms += 1) {
    const v = describeSlotFit(ms);
    if (v.kind === 'unknown') { broke ??= `${ms} unknown`; continue; }
    const p = tsPlanSpeedFit(ms);
    // After the pipeline the effective duration is the fitted target, or the original.
    const effective = p.fit ? p.targetMs : ms;
    if (slotSpanForDuration(effective) !== v.slots) broke ??= `${ms}: told ${v.slots}, engine says ${slotSpanForDuration(effective)}`;
  }
  eq('the slot count shown always matches what the engine will charge', broke, null);
}

// Sweep every 10 ms across five slots plus the boundaries either side. A single
// disagreement anywhere means the Lambda would fit to a boundary the booking engine
// does not recognise, so this is an exact match, not a spot check.
{
  let mismatch = null;
  for (let ms = 0; ms <= 55_000; ms += 10) {
    if (slotSpan(ms) !== slotSpanForDuration(ms)) { mismatch = ms; break; }
  }
  eq('span matches at every 10 ms from 0 to 55 s', mismatch, null);
  for (const ms of [null, undefined, 0, -1]) {
    ok(`span agrees on ${String(ms)}`, slotSpan(ms) === slotSpanForDuration(ms));
  }
}

// ── 3. Invariants for every duration ─────────────────────────────────────────
console.log('planSpeedFit — invariants across the whole range');

{
  let brokeSpan = null, brokeRate = null, brokeTarget = null, brokeBand = null;
  for (let ms = 1; ms <= 60_000; ms += 1) {
    const p = planSpeedFit(ms);
    if (!p.fit) {
      // A refusal must be justified: either one slot already, or a real overshoot.
      if (slotSpan(ms) >= 2 && ms - (slotSpan(ms) - 1) * SLOT_DURATION_MS <= MAX_SPEED_FIT_MS) brokeBand ??= ms;
      continue;
    }
    // The whole point: after the retime the clip books one slot FEWER than before.
    if (slotSpanForDuration(p.targetMs) !== slotSpan(ms) - 1) brokeSpan ??= ms;
    // The target is always a whole number of slots.
    if (p.targetMs % SLOT_DURATION_MS !== 0) brokeTarget ??= ms;
    // Never slow a clip down, and never speed it past the band's implied ceiling.
    // overshoot <= 1000 over a target of >= 10000 caps the rate at 1.1.
    if (!(p.rate > 1 && p.rate <= 1.1 + 1e-9)) brokeRate ??= ms;
  }
  eq('a fit always saves exactly one slot', brokeSpan, null);
  eq('a fit always targets a whole slot multiple', brokeTarget, null);
  eq('rate is always >1 and <=1.1', brokeRate, null);
  eq('nothing inside the band is refused', brokeBand, null);
}

// The retimed length must survive the round trip: the file the device actually plays
// has to read back to the booking engine as the CHEAPER span, or the retime bought
// nothing and the brand still pays double.
//
// The slop band is measured, not guessed. Encoding 10.6 s and 30.6 s sources through
// the exact ffmpeg arguments index.mjs builds (libx264 and libx265, with and without
// audio) landed every output at target + 67 ms — two frames at 30 fps, which is what
// `-r 30` costs when it resamples. 200 ms is that with room to spare, and still well
// inside the 490 ms grace that decides the span.
{
  const SLOP_MS = 200;
  let broke = null;
  for (const ms of [10_500, 10_600, 10_900, 11_000, 20_500, 30_600, 40_800]) {
    const p = planSpeedFit(ms);
    if (!p.fit) { broke ??= `${ms} not fitted`; continue; }
    for (const slop of [-SLOP_MS, -67, 0, 67, SLOP_MS]) {
      if (slotSpanForDuration(p.targetMs + slop) !== slotSpan(ms) - 1) broke ??= `${ms} slop ${slop}`;
    }
  }
  eq('fitted length still reads as the cheaper span after encoder slop', broke, null);
  // The grace is what absorbs that slop; if it ever shrinks below the slop the retime
  // silently stops working, so state the dependency rather than leaving it implicit.
  ok('the snap grace is wider than the measured encoder slop', SLOT_SNAP_GRACE_MS > SLOP_MS);
}

console.log(`\n${checks} assertions, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
