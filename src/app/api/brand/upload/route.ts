// POST /api/brand/upload?paymentId=...&orderId=...
// Brand-side creative upload — auth is the Razorpay paymentId/orderId tied to a Campaign row.
// Uploaded file goes to R2 under campaigns/{campaignId}/ and the URL is appended to Campaign.creativeUrls.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { putObject, publicUrl } from '@/lib/r2';
import crypto from 'crypto';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get('paymentId')?.trim();
  const orderId   = searchParams.get('orderId')?.trim();

  if (!paymentId && !orderId) {
    return NextResponse.json({ error: 'paymentId or orderId required' }, { status: 401 });
  }

  // Find a campaign with this paymentId or orderId — this is the auth proof
  const campaign = await db.campaign.findFirst({
    where: paymentId ? { paymentId } : { orderId: orderId! },
    select: { id: true, name: true, creativeUrls: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found for this payment' }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 4 MB per upload — compress with HandBrake (video) or TinyPNG (image) first.` }, { status: 413 });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP images or MP4 video allowed.' }, { status: 400 });
    }

    const ext   = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const key   = `campaigns/${campaign.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await putObject(key, Buffer.from(bytes), file.type);
    const url   = publicUrl(key);

    await db.campaign.update({
      where: { id: campaign.id },
      data:  { creativeUrls: { push: url } },
    });

    return NextResponse.json({ url, campaignId: campaign.id, campaignName: campaign.name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
