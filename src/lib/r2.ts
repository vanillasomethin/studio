// Cloudflare R2 helper — direct browser-to-R2 upload via signed PUT URLs.
// Avoids Vercel function payload limits and zero egress fees on R2.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

export async function signedUploadUrl(objectKey: string, contentType: string, expiresInSeconds = 600): Promise<string> {
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
