// Behavioural tests for slot spans — run with: npx tsx span-tests.mts
// Not committed; verification artifact for the feature/slot-spans branch.
import {
  slotSpanForDuration, uniformSlotSpan, buildSlotLoop, SLOT_DURATION_MS,
} from './src/lib/slots';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};

// ── slotSpanForDuration: ±0.49s snap, round-up ───────────────────────────────
for (const [d, want] of [
  [null, 1], [0, 1], [5000, 1], [9500, 1], [9970, 1], [10000, 1], [10030, 1],
  [10490, 1], [10510, 2], [11000, 2], [16000, 2], [19500, 2], [20490, 2],
  [20510, 3], [25000, 3], [30000, 3], [30400, 3], [30600, 4], [40000, 4], [60000, 6],
] as const) {
  eq(`spanFor(${d})`, slotSpanForDuration(d), want);
}

// ── uniformSlotSpan ──────────────────────────────────────────────────────────
eq('uniform: empty', uniformSlotSpan([]), { span: 1 });
eq('uniform: one 30s video', uniformSlotSpan([{ contentId: 'a', durationMs: 30000, type: 'VIDEO' }]), { span: 3 });
eq('uniform: three 10s-ish videos', uniformSlotSpan([
  { contentId: 'a', durationMs: 9970, type: 'VIDEO' },
  { contentId: 'b', durationMs: 10030, type: 'VIDEO' },
  { contentId: 'c', durationMs: 10000, type: 'VIDEO' },
]), { span: 1 });
eq('uniform: mixed rejected', 'error' in uniformSlotSpan([
  { contentId: 'a', durationMs: 10000, type: 'VIDEO' },
  { contentId: 'b', durationMs: 30000, type: 'VIDEO' },
]), true);
eq('uniform: unknown video duration rejected', 'error' in uniformSlotSpan([
  { contentId: 'a', durationMs: null, type: 'VIDEO' },
]), true);
eq('uniform: image ok', uniformSlotSpan([{ contentId: 'a', durationMs: null, type: 'IMAGE' }]), { span: 1 });
eq('uniform: image + 10s video', uniformSlotSpan([
  { contentId: 'a', durationMs: null, type: 'IMAGE' },
  { contentId: 'b', durationMs: 10000, type: 'VIDEO' },
]), { span: 1 });

// ── buildSlotLoop ────────────────────────────────────────────────────────────
const FILLER = { campaignId: 'house', creativeIds: ['h1'] };

// Legacy shape: singles only — identical to pre-span behaviour, spanSlots all 1.
{
  const loop = buildSlotLoop(6, [
    { slotPosition: 0, campaignId: 'A', creativeIds: ['a1'] },
    { slotPosition: 3, campaignId: 'B', creativeIds: ['b1'] },
  ], FILLER, 0);
  eq('legacy: 6 assignments', loop.length, 6);
  eq('legacy: all span 1', loop.every((a) => a.spanSlots === 1), true);
  eq('legacy: pos0 sold A', { c: loop[0].campaignId, f: loop[0].isFiller }, { c: 'A', f: false });
  eq('legacy: bonus round-robin', loop[1].isFiller && loop[1].campaignId === 'A', true);
}

// A 3-slot placement: one assignment at the head, covered positions emitted for
// nobody, bonus pool excludes the multi-slot campaign.
{
  const loop = buildSlotLoop(8, [
    { slotPosition: 2, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 3, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 4, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 6, campaignId: 'S', creativeIds: ['s1'], creativeSpan: 1 },
  ], FILLER, 0);
  const head = loop.find((a) => a.slotPosition === 2)!;
  eq('span: head emits 3-slot window', { span: head.spanSlots, filler: head.isFiller }, { span: 3, filler: false });
  eq('span: covered 3,4 not emitted', loop.filter((a) => a.slotPosition === 3 || a.slotPosition === 4).length, 0);
  eq('span: bonus never M', loop.filter((a) => a.isFiller).every((a) => a.campaignId === 'S'), true);
  // positions 0,1,5,7 = bonus of S; 6 = sold S; total assignments: 4 bonus + head + sold = 6
  eq('span: assignment count', loop.length, 6);
  eq('span: covered positions sum', loop.reduce((n, a) => n + a.spanSlots, 0), 8);
}

// Zero sold besides one multi-slot campaign: empties go to FILLER (M can't bonus-fill).
{
  const loop = buildSlotLoop(6, [
    { slotPosition: 0, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 2 },
    { slotPosition: 1, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 2 },
  ], FILLER, 0);
  eq('span-only: filler fills the rest', loop.filter((a) => a.campaignId === 'house').length, 4);
  eq('span-only: no M bonus', loop.filter((a) => a.campaignId === 'M').length, 1);
}

// Unplayable span group: sold-but-no-creative window joins redistribution (never dark).
{
  const loop = buildSlotLoop(5, [
    { slotPosition: 1, campaignId: 'M', creativeIds: [], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 2, campaignId: 'M', creativeIds: [], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 3, campaignId: 'M', creativeIds: [], spanId: 'g1', creativeSpan: 3 },
  ], FILLER, 0);
  eq('unplayable span: all 5 positions play filler', loop.length, 5);
  eq('unplayable span: all filler', loop.every((a) => a.isFiller && a.campaignId === 'house'), true);
}

// Corrupt group (middle row deleted directly in DB): survivors act as one shorter
// window at the head; the hole is redistributed; nothing dark, order strictly increasing.
{
  const loop = buildSlotLoop(8, [
    { slotPosition: 2, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 3 },
    { slotPosition: 4, campaignId: 'M', creativeIds: ['m1'], spanId: 'g1', creativeSpan: 3 },
  ], FILLER, 0);
  const head = loop.find((a) => a.slotPosition === 2)!;
  eq('corrupt: head window = surviving rows', head.spanSlots, 2);
  eq('corrupt: hole at 3 redistributed', loop.some((a) => a.slotPosition === 3 && a.isFiller), true);
  eq('corrupt: position 4 consumed', loop.filter((a) => a.slotPosition === 4).length, 0);
  eq('corrupt: order strictly increasing', loop.every((a, i) => i === 0 || a.slotPosition > loop[i - 1].slotPosition), true);
}

// Rotation across plays counts group plays once, dayIndex advances daily.
{
  const rot = (day: number) => buildSlotLoop(4, [
    { slotPosition: 0, campaignId: 'R', creativeIds: ['r1', 'r2', 'r3'], creativeSpan: 1 },
    { slotPosition: 1, campaignId: 'R', creativeIds: ['r1', 'r2', 'r3'], creativeSpan: 1 },
  ], null, day).map((a) => a.contentId);
  eq('rotation day0: k-th play advances', rot(0).slice(0, 2), ['r1', 'r2']);
  eq('rotation day1: shifted by dayIndex', rot(1).slice(0, 2), ['r2', 'r3']);
}

// poolWeights still bias single-slot campaigns only.
{
  const loop = buildSlotLoop(8, [
    { slotPosition: 0, campaignId: 'A', creativeIds: ['a1'], creativeSpan: 1 },
    { slotPosition: 1, campaignId: 'B', creativeIds: ['b1'], creativeSpan: 1 },
  ], null, 0, new Map([['B', 2]]));
  const bonus = loop.filter((a) => a.isFiller);
  const bCount = bonus.filter((a) => a.campaignId === 'B').length;
  const aCount = bonus.filter((a) => a.campaignId === 'A').length;
  eq('weights: B outweighs A in bonus', bCount > aCount, true);
}

// Single-slot booking whose campaign now carries a 30s creative (swap after booking):
// window stays 1 slot (grid intact) and the campaign is excluded from bonus fill.
{
  const loop = buildSlotLoop(4, [
    { slotPosition: 0, campaignId: 'M', creativeIds: ['m1'], creativeSpan: 3 },
  ], FILLER, 0);
  eq('swap: single stays 1 slot', loop.find((a) => a.slotPosition === 0)!.spanSlots, 1);
  eq('swap: no M bonus', loop.filter((a) => a.isFiller).every((a) => a.campaignId === 'house'), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
