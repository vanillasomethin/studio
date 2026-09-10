// Does an uploaded video already satisfy what the transcode would produce?
//
// Split out of index.mjs so it can be exercised without pulling in the ffmpeg/ffprobe
// installer packages (which only exist inside the Lambda's own node_modules, built for
// linux/x64). Keep this file dependency-free — scripts/verify-transcode-skip.mjs in the
// studio app imports it directly, and the Dockerfile COPYs it alongside index.mjs.

// Level 4.1's frame-size budget is 8704 macroblocks; 1920x1080 and 1080x1920 both come
// to 8160, so the real cap is on total pixels, not on which side happens to be longer.
export const MAX_PIXELS  = 1920 * 1080;
export const MAX_FPS     = 30;
export const MAX_BITRATE = 8_000_000; // the -maxrate the re-encode targets
export const SAFE_PROFILES = new Set(['Constrained Baseline', 'Baseline', 'Main']);

// The downscale box, as an ffmpeg scale filter expression.
//
// The cap has to follow the source's ORIENTATION, not sit on width and height
// independently. `min(1920,iw):min(1080,ih)` looks symmetric but collapses to a 1080x1080
// box for any portrait source, and fitting 9:16 into that yields 608x1080 — so a native
// 1080x1920 master, which is what SOP 7.2 asks brands to deliver and what every
// portrait-mounted panel wants, lost 44% of its width for nothing. Level 4.1's budget is
// 8704 macroblocks and 1080x1920 is 8160 of them, exactly as legal as 1920x1080; the
// constraint was never on which side is longer.
//
// The trailing crop rounds both dimensions down to even — aspect-fit can still yield an
// odd width (1440x2732 -> 1012x1920) and libx264/x265 reject odd dimensions in yuv420p.
// (force_divisible_by would be cleaner but needs a newer ffmpeg than the pinned build.)
export const SCALE_FILTER =
  "scale=w='if(gt(iw,ih),min(1920,iw),min(1080,iw))':h='if(gt(iw,ih),min(1080,ih),min(1920,ih))'" +
  ':force_original_aspect_ratio=decrease,crop=trunc(iw/2)*2:trunc(ih/2)*2';

/** ffprobe reports r_frame_rate as a rational string ("30/1", "30000/1001"). */
export function parseFps(r) {
  if (!r) return null;
  const [num, den] = String(r).split('/').map(Number);
  if (!num || !den) return null;
  return num / den;
}

/**
 * True when the upload is ALREADY what the re-encode would produce, so running ffmpeg
 * over it would only spend a generation of quality to arrive back where it started.
 *
 * Deliberately strict, because the two failure directions are not symmetric: a false
 * positive serves a file a budget panel can't decode — a black screen in a shop, found
 * whenever someone next walks past it — while a false negative just re-encodes something
 * that didn't strictly need it, which is exactly the pre-existing behaviour.
 *
 * @param video   ffprobe stream entry with codec_type 'video' (or undefined)
 * @param audio   ffprobe stream entry with codec_type 'audio' (or undefined — fine)
 * @param bitrate overall bitrate in bits/sec, or null when it could not be determined
 */
export function isAlreadySafe(video, audio, bitrate) {
  if (!video) return false;
  if (video.codec_name !== 'h264') return false;
  // High is excluded even at a legal level. The SOP §4.1 Realtek fault was observed on
  // High@5.0, and nothing has established that High@4.1 clears that decoder — the
  // pipeline's stated target is Main, so Main is what gets waved through.
  if (!SAFE_PROFILES.has(video.profile)) return false;
  if (typeof video.level !== 'number' || video.level > 41) return false;
  if (video.pix_fmt !== 'yuv420p') return false; // 10-bit/HDR never passes; these chips are 8-bit only
  if (!video.width || !video.height) return false;
  if (video.width * video.height > MAX_PIXELS) return false;
  const fps = parseFps(video.r_frame_rate);
  if (fps === null || fps > MAX_FPS + 0.01) return false;
  // The panels that need this rendition are the ones the SOP §4.1 blocklists drop to
  // SOFTWARE decode, and software decode is bitrate-sensitive — never wave a hot file
  // through just because its profile happens to be legal. An undetermined bitrate is
  // treated as unsafe rather than assumed fine.
  if (!bitrate || bitrate > MAX_BITRATE) return false;
  // Absent audio is fine; present-but-not-AAC is not, since the re-encode is otherwise
  // the only step that normalises it.
  if (audio && audio.codec_name !== 'aac') return false;
  return true;
}
