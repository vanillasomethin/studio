// ALIVE content transcode Lambda.
//
// Triggered (fire-and-forget) by POST /api/admin/transcode in the studio app right
// after a video finishes uploading. Runs entirely on Lambda because ffmpeg can't run
// on Vercel serverless (binary size + execution-time limits) — same reasoning as the
// Remotion offer-video renderer (see ../REMOTION.md).
//
// What it does:
//   1. Downloads the original video from its public R2 URL.
//   2. Re-encodes to H.264 Main Profile / Level 4.1, yuv420p, <=1920x1080, 30fps,
//      AAC audio — a profile/level virtually every Android TV hardware decoder
//      (Realtek, Amlogic, Allwinner, MediaTek) supports. Budget Realtek SoCs in the
//      field have been observed rejecting High Profile / Level 5.0 sources at
//      MediaCodec init time even though ExoPlayer's format-support pre-check reports
//      them as supported (OMX capability reporting quirk) — that's the failure this
//      exists to prevent.
//   3. Uploads the re-encoded file to R2 under a NEW object key (so any device that
//      already cached the original under its old hash is unaffected — it'll pick up
//      the new key on its next plan fetch, verify against the new hash, and download
//      fresh, exactly like any other content update).
//   4. Best-effort: also re-encodes to HEVC/H.265 at ~half the H.264 bitrate and
//      uploads it as a second rendition. Some fleet devices have a broken hardware
//      AVC decoder (falls back to CPU-bound software decode) but a working hardware
//      HEVC decoder — the player prefers this rendition on those devices. Failure here
//      doesn't fail the job; the H.264 rendition is always the required baseline.
//   5. Best-effort: also re-encodes to H.264 Baseline Profile / Level 3.1, capped at
//      720p — a third, even more conservative rendition for the handful of devices
//      that fail BOTH renditions above. Server-selected per-device via
//      Device.renditionTier once a real playback failure is reported (see
//      src/lib/rendition.ts in the studio app) — never picked by fleet-wide default.
//   6. Calls back to the studio app with the result(s) so it can update the Content row.
//
// Required Lambda configuration (see ../TRANSCODE_LAMBDA.md for full deploy steps):
//   Memory:    >= 2048 MB (more memory = more CPU in Lambda, needed for ffmpeg)
//   Timeout:   >= 300 s   (a few minutes for a ~100 MB clip)
//   Ephemeral storage (/tmp): >= 2048 MB (holds input + output simultaneously)
//
// Env vars:
//   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
//   TRANSCODE_CALLBACK_SECRET  — shared secret, sent as x-transcode-secret header

import { randomUUID, createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';

const run = promisify(execFile);

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
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
  const tmpOutBaseline = `/tmp/${randomUUID()}-out-baseline.mp4`;

  try {
    if (!contentId || !inputUrl) throw new Error('contentId and inputUrl are required');

    // 1. Download original
    const resp = await fetch(inputUrl);
    if (!resp.ok) throw new Error(`Failed to download source (HTTP ${resp.status})`);
    await writeFile(tmpIn, Buffer.from(await resp.arrayBuffer()));

    // 2. Re-encode to a broadly hardware-decodable profile/level.
    // -profile:v main -level 4.1: the actual fix — covers up to 1920x1080(or portrait
    //   equivalent)@30fps and is what budget Realtek/Amlogic/Allwinner decoders expect.
    // -vf scale=...:force_original_aspect_ratio=decrease: never upscale, cap at 1080p.
    // -pix_fmt yuv420p: 8-bit only — 10-bit/HDR isn't supported on these chips.
    await run(ffmpegPath.path, [
      '-y', '-i', tmpIn,
      '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.1', '-pix_fmt', 'yuv420p',
      '-vf', "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
      '-r', '30', '-b:v', '6M', '-maxrate', '8M', '-bufsize', '12M',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      tmpOut,
    ]);

    // 3. Probe the output for the real duration/dimensions to store on Content.
    const { stdout } = await run(ffprobePath.path, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json', tmpOut,
    ]);
    const probe = JSON.parse(stdout);
    const width = probe.streams?.[0]?.width;
    const height = probe.streams?.[0]?.height;
    const durationMs = probe.format?.duration ? Math.round(parseFloat(probe.format.duration) * 1000) : undefined;

    // 4. Upload under a NEW key + hash so devices treat it as a content update.
    const outBytes = await readFile(tmpOut);
    const md5 = createHash('md5').update(outBytes).digest('hex');
    const objectKey = `content/${contentId}-transcoded-${Date.now()}.mp4`;
    await r2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
      Body: outBytes,
      ContentType: 'video/mp4',
    }));

    // 5. Best-effort second rendition: same content re-encoded as HEVC/H.265, at
    //    roughly half the H.264 bitrate (HEVC is ~2x more efficient at equivalent
    //    quality). Some fleet devices have a broken hardware AVC decoder but a working
    //    hardware HEVC one — this rendition lets those play HD content in hardware
    //    instead of falling back to a CPU-bound software AVC decoder. Never blocks the
    //    required H.264 rendition above: on failure, just log and move on.
    let hevcResult;
    try {
      await run(ffmpegPath.path, [
        '-y', '-i', tmpIn,
        '-c:v', 'libx265', '-tag:v', 'hvc1', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
        '-vf', "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
        '-r', '30', '-b:v', '3M', '-maxrate', '4M', '-bufsize', '6M',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
        tmpOutHevc,
      ]);
      const hevcBytes = await readFile(tmpOutHevc);
      const hevcMd5 = createHash('md5').update(hevcBytes).digest('hex');
      const hevcObjectKey = `content/${contentId}-transcoded-hevc-${Date.now()}.mp4`;
      await r2Client().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: hevcObjectKey,
        Body: hevcBytes,
        ContentType: 'video/mp4',
      }));
      hevcResult = { hevcObjectKey, hevcMd5, hevcSizeBytes: hevcBytes.length };
    } catch (err) {
      console.error('HEVC transcode failed (non-fatal, H.264 rendition still used):', err);
    }

    // 6. Best-effort third rendition: H.264 Baseline Profile / Level 3.1, capped at
    //    720p. The most conservative encode this pipeline produces — no B-frames, no
    //    CABAC (both disabled implicitly by Baseline Profile), lower resolution/bitrate
    //    than the Main@4.1 rendition above. Reserved for devices that have already
    //    failed BOTH the HEVC and Main@4.1 renditions (see Device.renditionTier) — the
    //    small handful of chips in the field too weak/broken even for the fleet-wide
    //    default. Never blocks the required H.264 Main rendition: on failure, just log.
    let baselineResult;
    try {
      await run(ffmpegPath.path, [
        '-y', '-i', tmpIn,
        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-pix_fmt', 'yuv420p',
        '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
        '-r', '30', '-b:v', '3M', '-maxrate', '4M', '-bufsize', '6M',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
        tmpOutBaseline,
      ]);
      const baselineBytes = await readFile(tmpOutBaseline);
      const baselineMd5 = createHash('md5').update(baselineBytes).digest('hex');
      const baselineObjectKey = `content/${contentId}-transcoded-baseline-${Date.now()}.mp4`;
      await r2Client().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: baselineObjectKey,
        Body: baselineBytes,
        ContentType: 'video/mp4',
      }));
      baselineResult = { baselineObjectKey, baselineMd5, baselineSizeBytes: baselineBytes.length };
    } catch (err) {
      console.error('Baseline transcode failed (non-fatal, H.264 Main rendition still used):', err);
    }

    await callback({
      contentId, status: 'done', objectKey, md5,
      sizeBytes: outBytes.length, durationMs, width, height,
      ...hevcResult,
      ...baselineResult,
    });
  } catch (err) {
    console.error('Transcode failed:', err);
    await callback({ contentId, status: 'error', message: (err instanceof Error ? err.message : String(err)) });
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
    await unlink(tmpOutHevc).catch(() => {});
    await unlink(tmpOutBaseline).catch(() => {});
  }
};
