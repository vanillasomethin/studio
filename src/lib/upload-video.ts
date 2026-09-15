// Shared client-side upload pipeline: hash → probe → create the Content row →
// presign → PUT straight to R2. Extracted from content-tab.tsx so a second surface
// (the Add-brand panel's inline "upload a video" step) doesn't hand-roll its own copy
// of the R2/presign/XHR details — those are exactly the parts that rot when duplicated
// (see the CORS and 403 error copy below, written from real failures).

import { initiateUpload, transcodeVideo } from './backend-api';

export const MAX_UPLOAD_MB = 100;

/** Browsers expose the real duration via a hidden <video>'s loadedmetadata event —
 *  no server-side ffprobe needed before the file leaves the browser. */
export async function videoDurationMs(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    video.src = url;
  });
}

export async function imageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0
        ? { width: img.naturalWidth, height: img.naturalHeight }
        : undefined);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    img.src = url;
  });
}

export async function hashFile(file: File): Promise<string> {
  // Web Crypto doesn't support MD5; use full SHA-256 hex as the cache key.
  // Must NOT be truncated to 32 chars: the player's hashMatches() picks MD5
  // vs SHA-256 purely by string length (<=32 -> MD5), so a truncated SHA-256
  // gets misread as a real MD5 digest and never verifies — content downloads
  // forever fail integrity checks and never become playable.
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `nohash-${Date.now()}`;
  }
}

export type UploadedFile = { contentId: string; durationMs?: number; isVideo: boolean };

/** Full browser → R2 upload for one file, including the duration/dimension probe and
 *  the transcode kick-off. Throws with a message meant to be shown to an admin
 *  directly (wrong type, too large, R2/CORS failures) rather than a generic Error. */
export async function uploadContentFile(file: File, opts: {
  brandId?: string | null;
  /** Fires once the browser has measured the file — before any network call — so a
   *  caller can show what the length means (e.g. slot-fit) without waiting on upload. */
  onDurationKnown?: (durationMs: number | undefined, isVideo: boolean) => void;
  onProgress?: (pct: number) => void;
}): Promise<UploadedFile> {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) throw new Error('Only image or video files are supported.');

  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Too large (${mb} MB). Compress to under ${MAX_UPLOAD_MB} MB — try HandBrake (video) or TinyPNG (image).`);
  }

  const hash      = await hashFile(file);
  const durationMs = isVideo ? await videoDurationMs(file) : undefined;
  const dims      = isImage ? await imageDimensions(file) : undefined;
  opts.onDurationKnown?.(durationMs, isVideo);

  const pw = typeof window !== 'undefined' ? (sessionStorage.getItem('alive_admin_pw') ?? '') : '';

  // Step 1: create the DB record + get the objectKey it will live at.
  const { id: contentId, objectKey } = await initiateUpload({
    name:      file.name.replace(/\.[^.]+$/, ''),
    type:      isVideo ? 'video' : 'image',
    mimeType:  file.type || undefined,
    sizeBytes: file.size,
    md5:       hash,
    durationMs,
    width:     dims?.width,
    height:    dims?.height,
    brandId:   opts.brandId ?? null,
  });

  // Step 2: ask the server to presign a PUT for this exact key + content type. The
  // signature covers Content-Type, so the PUT below must send the identical value.
  const contentType = file.type || 'application/octet-stream';
  const signRes = await fetch(
    `/api/admin/r2-upload?key=${encodeURIComponent(objectKey)}&type=${encodeURIComponent(contentType)}`,
    { headers: pw ? { 'admin-password': pw } : {} },
  );
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Could not start upload (server returned ${signRes.status}).`);
  }
  const { uploadUrl } = await signRes.json() as { uploadUrl: string };

  // Step 3: PUT the bytes straight to R2. They never traverse a serverless function,
  // so the ~4.5 MB Vercel request-body cap doesn't apply.
  const xhr = new XMLHttpRequest();
  xhr.upload.onprogress = (ev) => {
    if (ev.lengthComputable) opts.onProgress?.(Math.round((ev.loaded / ev.total) * 100));
  };
  await new Promise<void>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status < 300) { resolve(); return; }
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      if (xhr.status === 403) {
        reject(new Error('R2 rejected the upload (403). The signed link may have expired — try again. If it keeps failing, check the bucket\'s CORS rules (docs/R2_CORS.md).'));
        return;
      }
      reject(new Error(`Couldn't upload "${file.name}" (${mb} MB) — R2 returned ${xhr.status}.`));
    };
    // A direct-to-R2 PUT that fails CORS preflight surfaces here as a generic network
    // error with no status, so name that cause explicitly.
    xhr.onerror = () => reject(new Error(
      'Upload failed before reaching R2 — usually missing/incorrect bucket CORS rules ' +
      '(needs PUT allowed from this origin, see docs/R2_CORS.md), otherwise a connection drop.',
    ));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });

  // Queue a background re-encode for hardware-decoder compatibility (see
  // transcode-lambda/) — best-effort, doesn't block the caller on it.
  if (isVideo) transcodeVideo(contentId).catch(() => {});

  return { contentId, durationMs, isVideo };
}
