import { NextRequest, NextResponse } from 'next/server';
import { putObject, publicUrl, putPrivateObject, isPrivateBucketConfigured } from '@/lib/r2';
import { resolveStoreId } from '@/lib/store-partner-auth';
import crypto from 'crypto';

export const maxDuration = 30;

// POST — store partner image upload for product photos / offer images / KYC docs
// Body: FormData with 'file' (File) and, from the mobile app, 'storeId'. Max 4 MB.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const storeId = await resolveStoreId((form.get('storeId') as string | null) ?? req.nextUrl.searchParams.get('storeId'));
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 4 MB.` }, { status: 413 });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images allowed.' }, { status: 400 });
    }

    const ext   = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const bytes = await file.arrayBuffer();

    // Identity documents (PAN, Aadhaar, KYC selfie) go to the private bucket and
    // are never given a public URL — the caller gets an opaque key it can only
    // exchange for bytes through the authenticated /api/stores/kyc/doc route.
    // Everything else (product photos, offer images) stays public as before.
    if ((form.get('kind') as string | null) === 'kyc') {
      if (!isPrivateBucketConfigured()) {
        return NextResponse.json(
          { error: 'Document upload is temporarily unavailable. Please contact hello@wearealive.in.' },
          { status: 503 },
        );
      }
      // Prefixed with the owning store so the doc route can prove ownership from
      // the key alone, independent of what the database happens to hold.
      const key = `kyc/${storeId}/${crypto.randomUUID()}.${ext}`;
      await putPrivateObject(key, Buffer.from(bytes), file.type);
      return NextResponse.json({ key });
    }

    const key = `stores/${storeId}/${crypto.randomUUID()}.${ext}`;
    await putObject(key, Buffer.from(bytes), file.type);

    return NextResponse.json({ url: publicUrl(key) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
