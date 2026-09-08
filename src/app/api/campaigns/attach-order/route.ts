// POST /api/campaigns/attach-order — stamps a Razorpay order onto the caller's
// own pending_payment campaign, so verify-payment's orderId lookup flips THAT
// row to active instead of minting a duplicate.
//
// campaigns/save refuses Razorpay ids outright because it is anonymous: an
// unauthenticated attach would let a caller squat a real pending order id and
// have the buyer's verify-payment activate the squatter's campaign. This route
// exists so the dashboard can do the stamping safely, and every check below is
// one leg of that safety:
//   • the session email must own the campaign row
//   • the row must still be awaiting payment (pending_payment, no paymentId)
//   • the order must have been created FOR this row — the dashboard asks
//     create-order for receipt `campaign_<id>`, and the order is read back from
//     Razorpay server-side, so an id lifted from someone else's checkout (or a
//     hand-minted order naming another row) never binds here
// Re-attaching is allowed while those hold: every retry of the pay button mints
// a fresh order, and the row should always carry the one checkout will charge.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { campaignId, orderId } = await req.json() as { campaignId?: string; orderId?: string };
    if (typeof campaignId !== 'string' || campaignId === ''
      || typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
      return NextResponse.json({ error: 'campaignId and orderId required' }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    // Same case-insensitive ownership rule as /api/campaigns/list.
    const owned = !!campaign?.email
      && campaign.email.trim().toLowerCase() === session.user.email.trim().toLowerCase();
    if (!campaign || !owned) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.status !== 'pending_payment' || campaign.paymentId) {
      return NextResponse.json({ error: 'This campaign is not awaiting payment.' }, { status: 409 });
    }

    const keyId     = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay credentials are not configured on the server.' }, { status: 500 });
    }
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!orderRes.ok) {
      return NextResponse.json({ error: 'Could not confirm the payment order. Please try again.' }, { status: 502 });
    }
    const order = await orderRes.json() as { receipt?: string; status?: string };
    if (order.receipt !== `campaign_${campaign.id}`) {
      return NextResponse.json({ error: 'That order was not created for this campaign.' }, { status: 409 });
    }
    if (order.status === 'paid') {
      // A settled order's verify-payment has already run against whatever row it
      // found — re-pointing it now could hand its payment to this row.
      return NextResponse.json({ error: 'That order has already been paid.' }, { status: 409 });
    }

    try {
      await db.campaign.update({ where: { id: campaign.id }, data: { orderId } });
    } catch (e) {
      // P2002: the unique index says another campaign already carries this
      // order — exactly the squat the index exists to stop.
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'That order is already attached to another campaign.' }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
