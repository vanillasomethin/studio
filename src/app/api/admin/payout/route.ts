import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { computeStorePayout, freezeColumns } from '@/lib/store-payout-db';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json() as {
    storeId: string; month: string; mode?: string; amount?: number;
    payRef?: string; note?: string;
  };
  const { storeId, month, mode = 'upi' } = body;

  if (!storeId || !month) {
    return NextResponse.json({ error: 'storeId and month are required' }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const existing = await db.storePayment.findUnique({
    where: { storeId_month: { storeId, month } },
  });
  // A settled month keeps the figure that was actually paid — re-running a
  // payout must not silently reprice it against today's bookings and tariff.
  const settled = existing?.status === 'paid' && existing.computedAt != null;

  // What this shop is actually owed: tier base + ad incentive + electricity.
  // The old `amount = 50000` default transferred a flat ₹500 to every partner
  // — wrong for every slot-tier and premium store, and blind to electricity.
  const breakdown = settled ? null : await computeStorePayout(storeId, month);
  if (!settled && !breakdown) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const computedPaise = breakdown?.totalPaise ?? existing?.amountPaise ?? 0;
  const override = typeof body.amount === 'number' && body.amount !== computedPaise ? body.amount : null;
  const amount = override ?? computedPaise;

  // Fetch store details via raw query (schema drift safe)
  const rows = await db.$queryRaw<Array<{
    storeName: string; ownerName: string; upiId: string | null;
    bankAccountNo: string | null; bankIfsc: string | null; bankAccountName: string | null;
  }>>`
    SELECT "storeName", "ownerName", "upiId", "bankAccountNo", "bankIfsc", "bankAccountName"
    FROM "Store" WHERE "id" = ${storeId}
  `;
  if (!rows.length) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const store = rows[0];

  const xKeyId     = process.env.RAZORPAY_X_KEY_ID;
  const xKeySecret = process.env.RAZORPAY_X_KEY_SECRET;
  const now = new Date();
  const amountRupees = Math.round(amount / 100); // convert paise to rupees

  let payRef: string | null = null;
  let status = 'pending';
  let message = '';

  if (xKeyId && xKeySecret) {
    // Razorpay X Payouts API
    try {
      const payoutBody: Record<string, unknown> = {
        account_number: process.env.RAZORPAY_X_ACCOUNT_NUMBER ?? '',
        amount,  // in paise
        currency: 'INR',
        mode: mode.toUpperCase(),  // UPI / NEFT / IMPS
        purpose: 'payout',
        narration: `ALIVE Monthly Payout ${month}`,
        fund_account: mode === 'upi' ? {
          account_type: 'vpa',
          vpa: { address: store.upiId },
          contact: {
            name: store.ownerName,
            type: 'vendor',
            reference_id: storeId,
          },
        } : {
          account_type: 'bank_account',
          bank_account: {
            name: store.bankAccountName ?? store.ownerName,
            ifsc: store.bankIfsc,
            account_number: store.bankAccountNo,
          },
          contact: {
            name: store.ownerName,
            type: 'vendor',
            reference_id: storeId,
          },
        },
      };

      const rzpRes = await fetch('https://api.razorpay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${xKeyId}:${xKeySecret}`).toString('base64')}`,
          'X-Payout-Idempotency': `${storeId}-${month}`,
        },
        body: JSON.stringify(payoutBody),
      });
      const rzpData = await rzpRes.json() as { id?: string; status?: string; error?: { description?: string } };
      if (!rzpRes.ok) throw new Error(rzpData.error?.description ?? 'Razorpay payout failed');
      payRef  = rzpData.id ?? null;
      status  = 'paid';
      message = `Payout initiated via Razorpay: ${payRef}`;
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  } else {
    // No Razorpay X — just record as pending with UPI link
    status  = 'pending';
    message = store.upiId
      ? `UPI: ${store.upiId} · ₹${amountRupees} · Add RAZORPAY_X_KEY_ID to automate`
      : `No UPI/bank details. Ask store to update their payout details.`;
  }

  // The admin's own UTR and note win over the generated message — they were
  // typed into the confirm dialog and then silently dropped, because the old
  // handler never destructured them off the body.
  const finalPayRef = body.payRef?.trim() || payRef;
  const finalNote   = body.note?.trim() || message;

  // Prisma upsert rather than raw SQL: the frozen breakdown is fifteen columns
  // and the old ON CONFLICT omitted "amountPaise" entirely, so re-running a
  // payout at a corrected amount kept the stale figure.
  await db.storePayment.upsert({
    where:  { storeId_month: { storeId, month } },
    create: {
      storeId, month, amountPaise: amount, status,
      paidAt: status === 'paid' ? now : null,
      payRef: finalPayRef, note: finalNote,
      ...(breakdown ? freezeColumns(breakdown) : {}),
    },
    update: {
      amountPaise: amount, status,
      paidAt: status === 'paid' ? now : undefined,
      payRef: finalPayRef, note: finalNote,
      // Empty for a settled row — its frozen breakdown stays as written.
      ...(breakdown ? freezeColumns(breakdown) : {}),
      updatedAt: now,
    },
  });

  // Money leaving the platform — logged only once the StorePayment row is
  // committed, so a Razorpay failure (which returns 502 above) never shows up in
  // the feed as a completed payout. Payment destinations (UPI id, bank account)
  // stay out of meta; the storeId is enough to look them up.
  await logAdminAction({
    actor, req,
    action: 'payout.create',
    target: storeId,
    meta: {
      month, mode, amountPaise: amount, status, payRef: finalPayRef,
      automated: !!(xKeyId && xKeySecret),
      // The derivation, so the trail explains the figure without a join. Plain
      // names — admin-audit blanks any meta name whose words include
      // key/hash/sig/pin, which would silently redact these.
      basePaise: breakdown?.basePaise ?? null,
      incentivePaise: breakdown?.incentivePaise ?? null,
      electricityPaise: breakdown?.electricityPaise ?? null,
      kwhSource: breakdown?.kwhSource ?? null,
      brandsPlayed: breakdown?.brandsPlayed ?? null,
      override: override != null,
      computedPaise,
      alreadySettled: settled,
    },
  });

  // Build UPI deep link for manual payment (always return this as fallback)
  const upiLink = store.upiId
    ? `upi://pay?pa=${encodeURIComponent(store.upiId)}&pn=${encodeURIComponent(store.ownerName)}&am=${amountRupees}&tn=${encodeURIComponent(`ALIVE ${month}`)}&cu=INR`
    : null;

  return NextResponse.json({ ok: true, status, message, payRef, upiLink, amountRupees });
}
