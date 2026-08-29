// Cloudflare R2 helper — server-side upload (avoids browser CORS restrictions on R2).

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function r2Client(): S3Client {
  const endpoint  = process.env.R2_ENDPOINT;
  const keyId     = process.env.R2_ACCESS_KEY_ID;
  const keySecret = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !keyId || !keySecret) {
    throw new Error('R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  }
  return new S3Client({
    region:      'auto',
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: keySecret },
  });
}

const BUCKET = () => process.env.R2_BUCKET ?? '';

// ── Private bucket (identity documents) ──────────────────────────────────────
//
// R2_BUCKET is served over a public r2.dev domain, which is per-BUCKET, not
// per-object: anything written there is readable by anyone holding the key.
// That is correct for ad creatives and APKs, and unacceptable for Aadhaar, PAN
// and KYC selfies, where a leaked or guessed key is an identity-document breach.
//
// Those go to a second bucket with NO public access. Nothing ever links to it
// directly — bytes are served only through an authenticated route that streams
// them (see /api/stores/kyc/doc), so the documents have no public address at all
// and cannot be enumerated, shared, or indexed.
const PRIVATE_BUCKET = () => process.env.R2_PRIVATE_BUCKET ?? '';

export function isPrivateBucketConfigured(): boolean {
  return !!process.env.R2_PRIVATE_BUCKET;
}

/** Upload to the private bucket. Never publicly addressable. */
export async function putPrivateObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const bucket = PRIVATE_BUCKET();
  if (!bucket) throw new Error('R2_PRIVATE_BUCKET is not configured — refusing to store identity documents in the public bucket.');
  await r2Client().send(new PutObjectCommand({
    Bucket: bucket, Key: objectKey, Body: body, ContentType: contentType,
  }));
}

/** Fetch bytes from the private bucket for an already-authorised caller. */
export async function getPrivateObject(objectKey: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  const bucket = PRIVATE_BUCKET();
  if (!bucket) return null;
  try {
    const res = await r2Client().send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const body = await res.Body?.transformToByteArray();
    if (!body) return null;
    return { body, contentType: res.ContentType ?? 'application/octet-stream' };
  } catch {
    return null; // missing object or transient failure — caller answers 404
  }
}

export async function deletePrivateObject(objectKey: string): Promise<void> {
  const bucket = PRIVATE_BUCKET();
  if (!bucket) return;
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })).catch(() => {});
}

// Server-side upload — pipe file bytes directly to R2 (no CORS issues)
export async function putObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const cmd = new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         objectKey,
    Body:        body,
    ContentType: contentType,
  });
  await r2Client().send(cmd);
}

// Primary path for admin content uploads: the browser PUTs straight to R2 so large
// files bypass the ~4.5 MB Vercel serverless request-body cap. Requires bucket CORS to
// allow PUT from the admin origin (docs/R2_CORS.md).
// Default expiry is generous because a 100 MB clip over a kirana store's uplink can
// legitimately take many minutes, and expiry is enforced at PUT start.
export async function signedUploadUrl(objectKey: string, contentType: string, expiresInSeconds = 3600): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client(), cmd, { expiresIn: expiresInSeconds });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const cmd = new DeleteObjectCommand({ Bucket: BUCKET(), Key: objectKey });
  await r2Client().send(cmd);
}

export function publicUrl(objectKey: string): string {
  const base = process.env.R2_PUBLIC_BASE ?? '';
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/${objectKey}`;
}
