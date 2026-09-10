// Verifies the probe-and-skip conformance rule in transcode-lambda/conformance.mjs —
// the predicate that decides whether an uploaded video is already what the transcode
// would produce, and so can be served untouched instead of re-encoded.
//
// Run: npm run verify:transcode-skip  (exits non-zero on failure)
//
// Two halves. The table below is pure and always runs. Below it, if a real ffmpeg is on
// PATH, actual files are encoded and probed with the same ffprobe arguments index.mjs
// uses, and the predicate is re-checked against genuine ffprobe output — that half is
// what catches a field-name or type drift (level as a string, profile spelled
// "Constrained Baseline" vs "constrained baseline") that hand-written fixtures can't.

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isAlreadySafe, parseFps, MAX_BITRATE, SCALE_FILTER } from '../transcode-lambda/conformance.mjs';

let failures = 0;
let checks = 0;
const eq = (name, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

// A source that passes every rule. Individual cases below spread over one field at a
// time, so each assertion names exactly the rule it is exercising.
const CONFORMANT = {
  codec_name: 'h264', profile: 'Main', level: 40, pix_fmt: 'yuv420p',
  width: 1080, height: 1920, r_frame_rate: '30/1',
};
const OK_BITRATE = 4_000_000;
const safe = (over = {}, audio = undefined, bitrate = OK_BITRATE) =>
  isAlreadySafe({ ...CONFORMANT, ...over }, audio, bitrate);

console.log('parseFps');
eq('integer rational', parseFps('30/1'), 30);
eq('NTSC rational', Math.round(parseFps('30000/1001') * 100) / 100, 29.97);
eq('missing is null', parseFps(undefined), null);
eq('zero denominator is null (ffprobe emits 0/0 for some streams)', parseFps('0/0'), null);

console.log('\nisAlreadySafe — the happy path');
eq('conformant portrait 1080x1920 Main@4.0 30fps skips', safe(), true);
eq('conformant landscape 1920x1080 skips', safe({ width: 1920, height: 1080 }), true);
eq('exactly level 4.1 skips', safe({ level: 41 }), true);
eq('Baseline skips', safe({ profile: 'Baseline' }), true);
eq('Constrained Baseline skips', safe({ profile: 'Constrained Baseline' }), true);
eq('AAC audio skips', safe({}, { codec_name: 'aac' }), true);
eq('no audio stream at all skips', safe({}, undefined), true);
eq('25fps master skips — the case -r 30 would add judder to', safe({ r_frame_rate: '25/1' }), true);
eq('24fps master skips', safe({ r_frame_rate: '24/1' }), true);
eq('29.97 NTSC skips (tolerance, not a hard 30)', safe({ r_frame_rate: '30000/1001' }), true);

console.log('\nisAlreadySafe — re-encode required');
eq('no video stream re-encodes', isAlreadySafe(undefined, undefined, OK_BITRATE), false);
eq('HEVC source re-encodes', safe({ codec_name: 'hevc' }), false);
eq('VP9 source re-encodes', safe({ codec_name: 'vp9' }), false);
eq('High profile re-encodes even at a legal level', safe({ profile: 'High' }), false);
eq('High 10 re-encodes', safe({ profile: 'High 10' }), false);
eq('level 5.0 re-encodes — the documented Realtek fault', safe({ level: 50 }), false);
eq('level as a string re-encodes rather than coercing', safe({ level: '40' }), false);
eq('10-bit pixel format re-encodes', safe({ pix_fmt: 'yuv420p10le' }), false);
eq('4:2:2 chroma re-encodes', safe({ pix_fmt: 'yuv422p' }), false);
eq('4K portrait re-encodes', safe({ width: 2160, height: 3840 }), false);
eq('4K landscape re-encodes', safe({ width: 3840, height: 2160 }), false);
eq('60fps re-encodes', safe({ r_frame_rate: '60/1' }), false);
eq('missing frame rate re-encodes', safe({ r_frame_rate: undefined }), false);
eq('zero width re-encodes', safe({ width: 0 }), false);
eq('non-AAC audio re-encodes', safe({}, { codec_name: 'opus' }), false);
eq('MP3 audio re-encodes', safe({}, { codec_name: 'mp3' }), false);

console.log('\nisAlreadySafe — bitrate ceiling protects the software-decode panels');
eq('at the ceiling skips', safe({}, undefined, MAX_BITRATE), true);
eq('just over the ceiling re-encodes', safe({}, undefined, MAX_BITRATE + 1), false);
eq('a 20 Mbps master re-encodes', safe({}, undefined, 20_000_000), false);
eq('undetermined bitrate re-encodes rather than assuming safe', safe({}, undefined, null), false);
eq('zero bitrate re-encodes', safe({}, undefined, 0), false);

// The pixel budget is a total, so a legal-area-but-absurd shape is still accepted; that
// is intentional (Level 4.1 constrains macroblock count, not aspect). Pin it so the
// behaviour is a decision rather than an accident.
eq('odd-but-small shape within the pixel budget skips', safe({ width: 640, height: 2048 }), true);

// ─── Integration: real files through the real ffprobe invocation ──────────────
function haveFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

// Byte-for-byte the argument list index.mjs passes; if that drifts, this stops proving
// anything and the mismatch should be loud.
function probe(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,profile,level,pix_fmt,width,height,r_frame_rate:format=duration,bit_rate',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const p = JSON.parse(out);
  const video = p.streams?.find((s) => s.codec_type === 'video');
  const audio = p.streams?.find((s) => s.codec_type === 'audio');
  const duration = p.format?.duration ? parseFloat(p.format.duration) : null;
  const bitrate = p.format?.bit_rate ? Number(p.format.bit_rate) : null;
  return { video, audio, bitrate, duration };
}

const ffmpegPresent = haveFfmpeg();
const tableChecks = checks;

if (!ffmpegPresent) {
  console.log('\nffmpeg/ffprobe not on PATH — skipping the real-file half.');
  console.log('The table above still ran; see the check count below.');
} else {
  console.log('\nisAlreadySafe — real encodes through the real ffprobe arguments');
  const dir = mkdtempSync(join(tmpdir(), 'alive-transcode-verify-'));
  const make = (name, args) => {
    const out = join(dir, name);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, out]);
    return out;
  };
  const src = (size, rate = 30) =>
    ['-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=${rate}:duration=1`];

  // testsrc2 is worst-case entropy, and single-pass ABR overshoots badly on a clip this
  // short — plain '-b:v 4M' lands at ~8.2 Mbps, over the conformance ceiling, which made
  // a genuinely conformant fixture look like a predicate bug. Cap it so the fixtures
  // exercise the rule under test rather than the bitrate rule.
  const CAPPED = ['-b:v', '2M', '-maxrate', '3M', '-bufsize', '4M'];
  // ...and assert that, so a future fixture drifting hot fails as itself.
  const assertUnderCeiling = (label, probed) =>
    eq(`  ...${label} fixture is under the bitrate ceiling (fixture sanity)`,
      probed.bitrate < MAX_BITRATE, true);

  try {
    // The shape the pipeline targets — must be recognised, or the skip never fires.
    const conformant = make('conformant.mp4', [
      ...src('1080x1920'),
      '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.1', '-pix_fmt', 'yuv420p',
      ...CAPPED,
    ]);
    const c = probe(conformant);
    assertUnderCeiling('conformant', c);
    eq('real Main@4.1 1080x1920 is recognised as conformant',
      isAlreadySafe(c.video, c.audio, c.bitrate), true);
    eq('  ...and ffprobe really does report level as a number', typeof c.video.level, 'number');
    eq('  ...and profile with the exact spelling the Set expects', c.video.profile, 'Main');

    // High profile is what consumer editors export by default — the single most
    // important negative case, since getting it wrong would skip nearly everything.
    const high = make('high.mp4', [
      ...src('1080x1920'),
      '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '4M',
    ]);
    const h = probe(high);
    eq('real High profile export is NOT skipped', isAlreadySafe(h.video, h.audio, h.bitrate), false);
    eq('  ...and ffprobe spells it "High"', h.video.profile, 'High');

    const hevc = make('hevc.mp4', [
      ...src('1080x1920'),
      // x265 prints its own encode summary regardless of -loglevel, which buries the
      // assertions in the CI group; it has a separate switch.
      '-c:v', 'libx265', '-x265-params', 'log-level=error',
      '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-b:v', '2M',
    ]);
    const v = probe(hevc);
    eq('real HEVC source is NOT skipped', isAlreadySafe(v.video, v.audio, v.bitrate), false);

    const uhd = make('uhd.mp4', [
      ...src('2160x3840'),
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', '4M',
    ]);
    const u = probe(uhd);
    eq('real 4K portrait is NOT skipped', isAlreadySafe(u.video, u.audio, u.bitrate), false);

    const sixty = make('sixty.mp4', [
      ...src('1080x1920', 60),
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', '4M',
    ]);
    const s = probe(sixty);
    eq('real 60fps source is NOT skipped', isAlreadySafe(s.video, s.audio, s.bitrate), false);

    // 25fps is the case the skip most needs to catch: conformant in every respect, and
    // the one `-r 30` would resample into visible judder.
    const pal = make('pal.mp4', [
      ...src('1080x1920', 25),
      '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.1', '-pix_fmt', 'yuv420p',
      ...CAPPED,
    ]);
    const p25 = probe(pal);
    assertUnderCeiling('25fps', p25);
    eq('real 25fps conformant master IS skipped', isAlreadySafe(p25.video, p25.audio, p25.bitrate), true);

    const tenBit = make('10bit.mp4', [
      ...src('1080x1920'),
      '-c:v', 'libx264', '-profile:v', 'high10', '-pix_fmt', 'yuv420p10le', '-b:v', '4M',
    ]);
    const t = probe(tenBit);
    eq('real 10-bit source is NOT skipped', isAlreadySafe(t.video, t.audio, t.bitrate), false);

    // ─── SCALE_FILTER: the box must follow the source's orientation ─────────────
    // Every fleet panel is portrait-mounted (SOP 4.5) and SOP 7.2 asks brands for
    // 1080x1920, so the portrait rows are the ones that actually ship.
    console.log('\nSCALE_FILTER — downscale box follows orientation');
    const scaled = (size) => {
      const out = make(`scaled-${size}.mp4`, [
        ...src(size),
        '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-vf', SCALE_FILTER,
        ...CAPPED,
      ]);
      const p = probe(out);
      return `${p.video.width}x${p.video.height}`;
    };
    eq('native portrait 1080x1920 survives intact', scaled('1080x1920'), '1080x1920');
    eq('native landscape 1920x1080 survives intact', scaled('1920x1080'), '1920x1080');
    eq('4K portrait caps to 1080x1920, not 608x1080', scaled('2160x3840'), '1080x1920');
    eq('4K landscape caps to 1920x1080', scaled('3840x2160'), '1920x1080');
    eq('tall phone master keeps its height', scaled('1440x2732'), '1012x1920');
    eq('sub-1080p portrait is never upscaled', scaled('720x1280'), '720x1280');
    eq('ultrawide fits the landscape box', scaled('3840x1080'), '1920x540');
    eq('square fits the portrait box width', scaled('2000x2000'), '1080x1080');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A suite that silently stops asserting still exits 0, so the count is itself an
// invariant — see the "green check != a guard that ran" note in ci.yml.
//
// The floor is per-half rather than one total, because the two halves have different
// preconditions. A single combined number cannot say "36 is complete without ffmpeg but
// a silent failure with it" — the first CI run of this suite proved that by measuring 36
// table checks against a 49 that had assumed ffmpeg was present. CI installs it now, so
// the integration floor is live there; the suite still runs table-only on a machine
// without it, and reports that as a skip rather than a pass.
const EXPECT_TABLE = 36;
const EXPECT_INTEGRATION = 20;
const integrationChecks = checks - tableChecks;

if (tableChecks < EXPECT_TABLE) {
  console.error(`\nOnly ${tableChecks} table checks ran, expected ${EXPECT_TABLE} — did a block get skipped?`);
  failures++;
}
if (ffmpegPresent && integrationChecks < EXPECT_INTEGRATION) {
  console.error(`\nOnly ${integrationChecks} integration checks ran, expected ${EXPECT_INTEGRATION} — did a fixture throw?`);
  failures++;
}
if (!ffmpegPresent) {
  console.log(`\nNOTE: ${EXPECT_INTEGRATION} integration checks did not run (no ffmpeg). CI installs it; this is a partial local run.`);
}

console.log(failures === 0
  ? `\nAll transcode skip rules verified (${checks} checks).`
  : `\n${failures} failure(s) across ${checks} checks.`);
process.exit(failures === 0 ? 0 : 1);
