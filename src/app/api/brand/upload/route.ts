// POST /api/brand/upload?paymentId=...
// Brand-side creative upload. Uploaded file goes to R2 under
// campaigns/{campaignId}/ and the URL is appended to Campaign.creativeUrls.
//
// Auth, in two layers:
//
//   paymentId — proof a payment actually settled. Only verify-payment writes it,
//   and only after checking the Razorpay signature, so holding one means the
//   payment for this campaign completed. This is the sole credential available
//   on the onboarding confirmation page, which is reached straight after
//   checkout with no session: requiring a login there would leave a brand that
//   has just paid unable to upload the creative they paid to run.
//
//   the session, when there is one — the dashboard uploader is behind a login,
//   and /api/campaigns/list already scopes campaigns to session.user.email, so
//   a signed-in brand can only ever see their own. Matching that here stops a
//   signed-in user spending a paymentId that leaked from somebody else's
//   campaign.
//
// orderId used to be accepted as an equivalent credential and no longer is. It
// is issued by create-order BEFORE any money moves and is handed to the browser
// at that point, so it authorised uploads to a campaign that had not been paid
// for. No caller ever passed it — both uploaders send paymentId — so it was a
// weaker door with nothing behind it.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { putObject, publicUrl } from '@/lib/r2';
import crypto from 'crypto';
import { getContentQuotaStatus } from '@/lib/content-quota-db';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get('paymentId')?.trim();

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId required' }, { status: 401 });
  }

  const campaign = await db.campaign.findFirst({
    where: { paymentId },
    select: { id: true, name: true, email: true, creativeUrls: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found for this payment' }, { status: 404 });

  // Case-insensitive, matching /api/campaigns/list — the address is typed at
  // signup and again at login, and a capitalisation difference must not lock a
  // brand out of their own campaign.
  const session = await auth().catch(() => null);
  const signedInAs = session?.user?.email?.toLowerCase();
  if (signedInAs && signedInAs !== campaign.email?.toLowerCase()) {
    return NextResponse.json({ error: 'This campaign belongs to another account.' }, { status: 403 });
  }

  const quota = await getContentQuotaStatus(campaign.id);
  if (!quota.allowed) {
    return NextResponse.json({
      error: `You've used your ${quota.used} creative change${quota.used === 1 ? '' : 's'} for this month on your plan. Upgrade your plan for more, or wait until next month.`,
    }, { status: 429 });
  }

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
    await db.auditLog.create({
      data: { action: 'creative_change', target: campaign.id, meta: { url } },
    }).catch(() => { /* the quota tracker is best-effort — never fail the upload over it */ });

    return NextResponse.json({ url, campaignId: campaign.id, campaignName: campaign.name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
