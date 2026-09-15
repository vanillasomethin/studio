// ALIVE content transcode Lambda.
//
// Triggered (fire-and-forget) by POST /api/admin/transcode in the studio app right
// after a video finishes uploading. Runs entirely on Lambda because ffmpeg can't run
// on Vercel serverless (binary size + execution-time limits) — same reasoning as the
// Remotion offer-video renderer (see ../REMOTION.md).
//
// What it does:
//   1. Downloads the original video from its public R2 URL.
//   2. Probes it. If the upload is ALREADY H.264 Main-or-lower @<=4.1, yuv420p, <=1080p,
//      <=30fps, <=8 Mbps with AAC-or-no audio, the re-encode below would reproduce the
//      file it started from, so it is skipped: the row keeps pointing at the upload and
//      transcodeStatus goes straight to 'done'. This is the only path on which a screen
//      plays bytes that were never through ffmpeg — worth it, because the re-encode is
//      lossy and `-r 30` in particular introduces frame-duplication judder on the 24/25fps
//      masters that agencies actually deliver. Step 4 still runs on this path.
//   2b. Decides whether the clip just tips over a slot boundary (10.51 s books TWO 10 s
//      slots, so the brand pays double for a window half full of frozen frame) and if so
//      plans a retime back onto the multiple — see speed-fit.mjs. A clip needing this
//      never takes the skip path in step 2, because retiming requires a re-encode.
//   3. Otherwise re-encodes to H.264 Main Profile / Level 4.1, yuv420p, 1080p in the
//      source's own orientation (1920x1080 landscape, 1080x1920 portrait), 30fps,
//      AAC audio — a profile/level virtually every Android TV hardware decoder
//      (Realtek, Amlogic, Allwinner, MediaTek) supports. Budget Realtek SoCs in the
//      field have been observed rejecting High Profile / Level 5.0 sources at
//      MediaCodec init time even though ExoPlayer's format-support pre-check reports
//      them as supported (OMX capability reporting quirk) — that's the failure this
//      exists to prevent.
//      Uploads the re-encoded file to R2 under a NEW object key (so any device that
//      already cached the original under its old hash is unaffected — it'll pick up
//      the new key on its next plan fetch, verify against the new hash, and download
//      fresh, exactly like any other content update).
//   4. Best-effort, on BOTH paths: also re-encodes to HEVC/H.265 at ~half the H.264
//      bitrate and uploads it as a second rendition. Some fleet devices have a broken
//      hardware AVC decoder (falls back to CPU-bound software decode) but a working
//      hardware HEVC decoder — the player prefers this rendition on those devices, and
//      it is the ONLY thing they can play, so a conformant H.264 source does not excuse
//      skipping it. Failure here doesn't fail the job.
//   5. Calls back to the studio app with the result(s) so it can update the Content row.
//
// Required Lambda configuration (see ../TRANSCODE_LAMBDA.md for full deploy steps):
//   Memory:    >= 2048 MB (more memory = more CPU in Lambda, needed for ffmpeg)
//   Timeout:   >= 300 s   (a few minutes for a ~100 MB clip)
//   Ephemeral storage (/tmp): >= 2048 MB (holds input + output simultaneously)
//
// Env vars:
//   STUDIO_CALLBACK_URL        — .../api/admin/transcode-callback (presign URL derived from it)
//   TRANSCODE_CALLBACK_SECRET  — shared secret, sent as x-transcode-secret header
//
// No R2 credentials here — they're Vercel-Sensitive (write-only) env vars that can never
// be exported to configure this function, which is how it once shipped with literal
// "[SENSITIVE]" strings in its env and failed every upload with "Invalid URL". Uploads
// go through the studio's /api/admin/transcode-presign instead (same shared secret);
// the studio runtime, which holds the real creds, signs each PUT.

import { randomUUID, createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { isAlreadySafe, parseFps, SCALE_FILTER } from './conformance.mjs';
import { planSpeedFit, speedFitFilters } from './speed-fit.mjs';

const run = promisify(execFile);

async function uploadViaPresign(objectKey, bytes, contentType) {
  const callbackUrl = process.env.STUDIO_CALLBACK_URL;
  if (!callbackUrl) throw new Error('STUDIO_CALLBACK_URL not set');
  const presignUrl = callbackUrl.replace(/\/transcode-callback\/?$/, '/transcode-presign');
  if (presignUrl === callbackUrl) throw new Error('STUDIO_CALLBACK_URL does not end in /transcode-callback');
  const presign = await fetch(presignUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-transcode-secret': process.env.TRANSCODE_CALLBACK_SECRET ?? '',
    },
    body: JSON.stringify({ objectKey, contentType }),
  });
  if (!presign.ok) throw new Error(`presign failed: HTTP ${presign.status} ${await presign.text().catch(() => '')}`);
  const { uploadUrl } = await presign.json();
  if (!uploadUrl) throw new Error('presign response missing uploadUrl');
  // The presign signature covers Content-Type — the PUT must send the same value.
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': contentType }, body: bytes });
  if (!put.ok) throw new Error(`R2 PUT failed: HTTP ${put.status} ${await put.text().catch(() => '')}`);
}

// Best-effort second rendition: the same source re-encoded as HEVC/H.265, at roughly
// half the H.264 bitrate (HEVC is ~2x more efficient at equivalent quality). Some fleet
// devices have a broken hardware AVC decoder but a working hardware HEVC one — this
// rendition lets those play HD content in hardware instead of falling back to a
// CPU-bound software AVC decoder. Never blocks the H.264 side: on failure, log and move
// on, returning nothing to spread into the callback body.
//
// Always encodes from the ORIGINAL, never from the H.264 rendition, so the two are
// independent single-generation encodes rather than a chain. That is also why it runs on
// the skip path: a source can be perfectly conformant H.264 and still be undecodable on
// the HiSilicon panels, which need this file to play anything at all.
//
// `fit` is the speed-fit plan, and it MUST be the same one the H.264 side used: the two
// renditions are the same ad, and a device that prefers HEVC would otherwise play a
// different length from its neighbour — which is the exact double-booking this feature
// exists to prevent, reintroduced on half the fleet.
async function encodeHevc(contentId, tmpIn, tmpOutHevc, fit, hasAudio) {
  try {
    const f = speedFitFilters(fit);
    await run(ffmpegPath.path, [
      '-y', '-i', tmpIn,
      '-c:v', 'libx265', '-tag:v', 'hvc1', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-vf', f ? `${SCALE_FILTER},${f.videoFilter}` : SCALE_FILTER,
      '-r', '30', '-b:v', '3M', '-maxrate', '4M', '-bufsize', '6M',
      // -filter:a on a file with no audio stream is a hard ffmpeg error, so it is only
      // added when the probe actually found one.
      ...(f && hasAudio ? ['-filter:a', f.audioFilter] : []),
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      tmpOutHevc,
    ]);
    const hevcBytes = await readFile(tmpOutHevc);
    const hevcMd5 = createHash('md5').update(hevcBytes).digest('hex');
    const hevcObjectKey = `content/${contentId}-transcoded-hevc-${Date.now()}.mp4`;
    await uploadViaPresign(hevcObjectKey, hevcBytes, 'video/mp4');
    return { hevcObjectKey, hevcMd5, hevcSizeBytes: hevcBytes.length };
  } catch (err) {
    console.error('HEVC transcode failed (non-fatal, H.264 side still used):', err);
    return undefined;
  }
}

async function callback(body) {
  const url = process.env.STUDIO_CALLBACK_URL;
  if (!url) throw new Error('STUDIO_CALLBACK_URL not set');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-transcode-secret': process.env.TRANSCODE_CALLBACK_SECRET ?? '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Nothing upstream is waiting synchronously — log so it's visible in CloudWatch.
    console.error(`Callback failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
  }
}

export const handler = async (event) => {
  const { contentId, inputUrl } = event;
  const tmpIn = `/tmp/${randomUUID()}-in`;
  const tmpOut = `/tmp/${randomUUID()}-out.mp4`;
  const tmpOutHevc = `/tmp/${randomUUID()}-out-hevc.mp4`;

  try {
    if (!contentId || !inputUrl) throw new Error('contentId and inputUrl are required');

    // 1. Download original
    const resp = await fetch(inputUrl);
    if (!resp.ok) throw new Error(`Failed to download source (HTTP ${resp.status})`);
    const inBytes = Buffer.from(await resp.arrayBuffer());
    await writeFile(tmpIn, inBytes);

    // 2. Probe the SOURCE before touching it. A creative exported straight to H.264
    // Main@4.1 1080p30 is already the file step 3 would produce, and re-encoding it buys
    // nothing but generation loss (and, for the 24/25fps masters agencies actually
    // deliver, the frame-duplication judder `-r 30` introduces). Skip steps 3-5 in that
    // case and keep serving the upload itself. Step 6 still runs either way — the
    // HiSilicon panels can't decode AVC at all, so a conformant H.264 source is exactly
    // as unplayable to them as a non-conformant one and they still need the HEVC file.
    const srcProbe = JSON.parse((await run(ffprobePath.path, [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,profile,level,pix_fmt,width,height,r_frame_rate:format=duration,bit_rate',
      '-of', 'json', tmpIn,
    ])).stdout);
    const srcVideo = srcProbe.streams?.find((s) => s.codec_type === 'video');
    const srcAudio = srcProbe.streams?.find((s) => s.codec_type === 'audio');
    const srcDurationSec = srcProbe.format?.duration ? parseFloat(srcProbe.format.duration) : null;
    // format.bit_rate is absent on some containers — fall back to the bytes we just
    // downloaded, since an unknown bitrate would otherwise fail the conformance check.
    const srcBitrate = srcProbe.format?.bit_rate
      ? Number(srcProbe.format.bit_rate)
      : (srcDurationSec ? Math.round((inBytes.length * 8) / srcDurationSec) : null);

    // 2b. Does this clip just tip over a slot boundary? See speed-fit.mjs for the rule.
    // Deciding it here, BEFORE the conformance skip, is load-bearing: a perfectly
    // conformant 10.6 s H.264 upload would otherwise be waved through untouched and
    // silently book two slots forever. Retiming requires a re-encode, so a clip that
    // needs one does not get to take the skip path.
    const srcDurationMs = srcDurationSec ? Math.round(srcDurationSec * 1000) : null;
    const fit = planSpeedFit(srcDurationMs);
    if (fit.fit) {
      console.log(
        `Speed-fitting ${srcDurationMs}ms -> ${fit.targetMs}ms ` +
        `(${fit.overshootMs}ms over, ${((fit.rate - 1) * 100).toFixed(1)}% faster) ` +
        'so it books one slot fewer',
      );
    }

    if (!fit.fit && isAlreadySafe(srcVideo, srcAudio, srcBitrate)) {
      console.log(
        `Source already conformant (h264 ${srcVideo.profile}@${srcVideo.level} ` +
        `${srcVideo.width}x${srcVideo.height} ${parseFps(srcVideo.r_frame_rate)?.toFixed(2)}fps ` +
        `${Math.round(srcBitrate / 1000)}kbps) — skipping H.264 re-encode`,
      );
      const hevcOnly = await encodeHevc(contentId, tmpIn, tmpOutHevc, fit, !!srcAudio);
      await callback({
        contentId, status: 'done', skipped: true,
        durationMs: srcDurationMs ?? undefined,
        width: srcVideo.width, height: srcVideo.height,
        ...hevcOnly,
      });
      return;
    }

    // 3. Re-encode to a broadly hardware-decodable profile/level.
    // -profile:v main -level 4.1: the actual fix — covers up to 1920x1080(or portrait
    //   equivalent)@30fps and is what budget Realtek/Amlogic/Allwinner decoders expect.
    // -vf SCALE_FILTER: never upscale, cap at 1080p in the source's own orientation.
    // -pix_fmt yuv420p: 8-bit only — 10-bit/HDR isn't supported on these chips.
    // -vf ...,setpts / -filter:a atempo: the speed-fit, when one was planned. It rides
    //   on the encode that was happening anyway, so it costs nothing extra, and the
    //   untouched source is still preserved in Content.originalObjectKey — the fit is
    //   non-destructive by construction.
    const f = speedFitFilters(fit);
    await run(ffmpegPath.path, [
      '-y', '-i', tmpIn,
      '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.1', '-pix_fmt', 'yuv420p',
      '-vf', f ? `${SCALE_FILTER},${f.videoFilter}` : SCALE_FILTER,
      '-r', '30', '-b:v', '6M', '-maxrate', '8M', '-bufsize', '12M',
      ...(f && srcAudio ? ['-filter:a', f.audioFilter] : []),
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      tmpOut,
    ]);

    // 4. Probe the output for the real duration/dimensions to store on Content.
    const { stdout } = await run(ffprobePath.path, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json', tmpOut,
    ]);
    const probe = JSON.parse(stdout);
    const width = probe.streams?.[0]?.width;
    const height = probe.streams?.[0]?.height;
    const durationMs = probe.format?.duration ? Math.round(parseFloat(probe.format.duration) * 1000) : undefined;

    // 5. Upload under a NEW key + hash so devices treat it as a content update.
    const outBytes = await readFile(tmpOut);
    const md5 = createHash('md5').update(outBytes).digest('hex');
    const objectKey = `content/${contentId}-transcoded-${Date.now()}.mp4`;
    await uploadViaPresign(objectKey, outBytes, 'video/mp4');

    // 6. Second rendition — see encodeHevc(). Same fit, or the two renditions disagree
    // about how long the ad is.
    const hevcResult = await encodeHevc(contentId, tmpIn, tmpOutHevc, fit, !!srcAudio);

    await callback({
      contentId, status: 'done', objectKey, md5,
      sizeBytes: outBytes.length, durationMs, width, height,
      // What the clip measured BEFORE the retime. Present only when one happened; the
      // studio shows it on the Content row, so "why does my ad look slightly faster"
      // has an answer that does not require reading CloudWatch.
      ...(fit.fit ? { speedFittedFromMs: srcDurationMs } : {}),
      ...hevcResult,
    });
  } catch (err) {
    console.error('Transcode failed:', err);
    await callback({ contentId, status: 'error', message: (err instanceof Error ? err.message : String(err)) });
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
    await unlink(tmpOutHevc).catch(() => {});
  }
};
