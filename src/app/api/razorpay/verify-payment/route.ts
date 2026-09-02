import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

type Body = {
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
  // Optional campaign payload — when present, campaign is upserted as 'active'
  campaign?: {
    brandName:      string;
    contactName:    string;
    email:          string;
    phone:          string;
    gstin?:         string;
    screens:        number;
    months:         number;
    startDate:      string;
    pricePerScreen: number;
    totalAmount:    number;
    couponCode?:    string;
    preferredStoreIds?: unknown; // store ids picked on the onboarding map
  };
};

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, campaign } =
      await req.json() as Body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    // Constant-time compare so the signature can't be recovered via timing.
    // timingSafeEqual throws on a length mismatch, so gate on length first.
    const sig = typeof razorpay_signature === 'string' ? razorpay_signature : '';
    const ok = sig.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Signature mismatch' }, { status: 400 });
    }

    // Upsert campaign — find by orderId if it already exists (pay-later flow), else create
    if (campaign) {
      // The client's totalAmount is display-only and never stored. The amount
      // actually charged lives on the Razorpay order (created server-side by
      // create-order), so fetch it back as the authoritative figure.
      const credentials = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
      ).toString('base64');
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${credentials}` },
      });
      if (!orderRes.ok) {
        return NextResponse.json({ success: false, error: 'Could not confirm the order amount. Please contact hello@wearealive.in.' }, { status: 502 });
      }
      const order = await orderRes.json() as {
        amount?: number;
        notes?: Record<string, string>;
      };
      const chargedRupees = Math.round(Number(order.amount ?? 0) / 100);

      // Entitlement comes from the ORDER, not the request body. create-order
      // stamped the screens/months it actually priced into the order notes, so
      // a client cannot pay for 1 screen × 1 month and then claim 50 × 12 by
      // editing the body. Orders created before this binding existed have no
      // notes — those fall back to the body but are clamped to the same
      // self-serve bounds create-order enforces.
      const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : dflt;
      };
      const paidScreens = order.notes?.alive_screens != null
        ? clamp(order.notes.alive_screens, 1, 50, 1)
        : clamp(campaign.screens, 1, 50, 1);
      const paidMonths = order.notes?.alive_months != null
        ? clamp(order.notes.alive_months, 1, 12, 1)
        : clamp(campaign.months, 1, 12, 1);

      // Case-insensitive so the campaign still links to its brand when the
      // address was typed with different capitalisation at signup.
      const brand = await db.brand.findFirst({
        where: { email: { equals: campaign.email, mode: 'insensitive' } },
      });

      // The coupon comes from the ORDER, exactly as screens and months do.
      // create-order granted the discount and stamped the code it honoured.
      // Reading it off the request body instead let a buyer take the discounted
      // price and then simply omit couponCode here — the redemption was never
      // counted, so a capped coupon could be redeemed without limit.
      const paidCoupon = typeof order.notes?.alive_coupon === 'string'
        ? order.notes.alive_coupon
        : null;

      // Count one redemption against the cap, atomically. The cap is checked at
      // create-order but incremented only here, so buyers who pass the check
      // concurrently would all redeem; the cap is therefore re-asserted inside
      // the same statement and the database decides who takes the last slot.
      // A zero-row result means someone else took it — the buyer has already
      // been charged the discounted amount, so the payment stands (failing a
      // settled transaction over a coupon is worse) but the counter stays true.
      const countRedemption = async (code: string) => {
        await db.coupon.updateMany({
          where: {
            code: code.toUpperCase(),
            OR: [
              { maxRedemptions: null },
              { redemptions: { lt: db.coupon.fields.maxRedemptions } },
            ],
          },
          data: { redemptions: { increment: 1 } },
        }).catch(() => {});
      };

      // Bring an existing campaign to `active`. Shared by the pay-later branch
      // and by the loser of a create race, which are the same situation once the
      // row exists: the payment is settled and the row must reflect it.
      const activateExisting = async (row: { id: string; status: string }) => {
        // Keep the row internally consistent: the charge was recomputed at
        // current rates, so the stored per-screen rate must follow it.
        const ppw = Math.floor(Number(campaign.pricePerScreen));
        // Only the transition into `active` is a redemption. A retried or
        // replayed verify for an already-active campaign must not count again.
        const wasAlreadyActive = row.status === 'active';
        await db.campaign.update({
          where: { id: row.id },
          data:  {
            paymentId: razorpay_payment_id,
            status: 'active',
            totalAmount: chargedRupees,
            screens: paidScreens,
            months:  paidMonths,
            ...(paidCoupon ? { couponCode: paidCoupon } : {}),
            ...(Number.isFinite(ppw) && ppw > 0 ? { pricePerScreen: ppw } : {}),
          },
        });
        // The pay-later flow reaches payment through here, so it counted no
        // redemptions at all until now.
        if (paidCoupon && !wasAlreadyActive) await countRedemption(paidCoupon);
      };

      // findUnique, not findFirst: orderId is unique now, so this is an index
      // lookup for the row that either exists or does not.
      const existing = await db.campaign.findUnique({ where: { orderId: razorpay_order_id } });

      if (existing) {
        await activateExisting(existing);
      } else {
        try {
          await db.campaign.create({
            data: {
              brandId:        brand?.id ?? null,
              name:           `${campaign.brandName} — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
              contactName:    campaign.contactName,
              email:          campaign.email,
              phone:          campaign.phone ?? undefined,
              screens:        paidScreens,
              months:         paidMonths,
              startDate:      new Date(campaign.startDate),
              pricePerScreen: campaign.pricePerScreen,
              totalAmount:    chargedRupees,
              couponCode:     paidCoupon,
              preferredStoreIds: Array.isArray(campaign.preferredStoreIds)
                ? campaign.preferredStoreIds
                    .filter((v): v is string => typeof v === 'string' && /^[a-z0-9]{20,32}$/.test(v))
                    .slice(0, 50)
                : [],
              paymentId:      razorpay_payment_id,
              orderId:        razorpay_order_id,
              status:         'active',
            },
          });

          if (paidCoupon) await countRedemption(paidCoupon);
        } catch (e) {
          // P2002 = the unique index on orderId rejected this insert, so a
          // concurrent confirmation of the same payment created the campaign
          // between our findUnique and this create. That is the race the index
          // exists to stop; the correct response is to adopt the winner's row,
          // not to fail a payment the buyer has already been charged for.
          //
          // Deliberately no countRedemption here: the winner already counted it.
          if ((e as { code?: string }).code !== 'P2002') throw e;
          const raced = await db.campaign.findUnique({ where: { orderId: razorpay_order_id } });
          if (raced) await activateExisting(raced);
        }
      }
    }

    return NextResponse.json({ success: true, payment_id: razorpay_payment_id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
