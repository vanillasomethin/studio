import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { computeStorePayout, freezeColumns } from '@/lib/store-payout-db';

// GET — list all store payments with store info
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');

  try {
    const where = storeId ? { storeId } : {};
    const payments = await db.storePayment.findMany({
      where,
      include: { store: { select: { storeName: true, ownerName: true, whatsapp: true, city: true, upiId: true, payoutMethod: true, liveAt: true } } },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(payments);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — upsert a payment record (mark paid, pending, skipped)
export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  try {
    const body = await req.json() as {
      storeId: string; month: string; status: string;
      amountPaise?: number; paidAt?: string; paidBy?: string; payRef?: string; note?: string;
    };
    if (!body.storeId || !body.month || !body.status) {
      return NextResponse.json({ error: 'storeId, month, status required' }, { status: 400 });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    }

    const existing = await db.storePayment.findUnique({
      where: { storeId_month: { storeId: body.storeId, month: body.month } },
    });

    // A settled month is HISTORY, not a live calculation. Every Skip/Unmark
    // click posts through here with just {storeId, month, status}, so
    // recomputing unconditionally would silently reprice an already-paid month
    // against today's bookings and today's tariff — the paid figure would drift
    // away from the money that actually left the account. Only an explicit
    // amountPaise override may move a settled row.
    const settled = existing?.status === 'paid' && existing.computedAt != null;

    // The SERVER decides the amount for anything not yet settled. The old
    // `?? 50000` fallback silently underpaid every tier and premium store — a
    // flat ₹500 for a Flagship partner owed ₹1,500 plus incentive plus
    // electricity — and it trusted whatever the browser sent. Same rule as
    // razorpay/verify-payment: a client total is display-only unless deliberate.
    const breakdown = settled ? null : await computeStorePayout(body.storeId, body.month);
    if (!settled && !breakdown) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const computedPaise = breakdown?.totalPaise ?? existing?.amountPaise ?? 0;
    const override = typeof body.amountPaise === 'number' && body.amountPaise !== computedPaise
      ? body.amountPaise
      : null;
    const amountPaise = override ?? computedPaise;

    // Freezing the derivation alongside the amount is what makes a settled month
    // answerable later: PlugReading self-prunes at 180 days and deleting a device
    // or campaign cascades its history away, so recomputing an old month can
    // legitimately produce a different number than the one that was paid.
    const frozen = breakdown ? freezeColumns(breakdown) : {};

    const payment = await db.storePayment.upsert({
      where: { storeId_month: { storeId: body.storeId, month: body.month } },
      create: {
        storeId: body.storeId,
        month:   body.month,
        status:  body.status,
        amountPaise,
        ...frozen,
        paidAt:  body.paidAt ? new Date(body.paidAt) : (body.status === 'paid' ? new Date() : null),
        paidBy:  body.paidBy ?? null,
        payRef:  body.payRef ?? null,
        note:    body.note ?? null,
      },
      update: {
        status:  body.status,
        amountPaise,
        // Empty for a settled row — the frozen columns stay exactly as written.
        ...frozen,
        paidAt:  body.paidAt ? new Date(body.paidAt) : (body.status === 'paid' ? new Date() : undefined),
        // `?? undefined` (leave as-is), NOT `?? null`. The tab's Skip/Unmark
        // buttons post only {storeId, month, status}, so nulling here wiped the
        // UTR and note off an already-paid month — destroying the evidence that
        // money moved, with one click and no warning.
        paidBy:  body.paidBy ?? undefined,
        payRef:  body.payRef ?? undefined,
        note:    body.note ?? undefined,
        updatedAt: new Date(),
      },
    });

    // This row is the record that a partner was paid — it is what the monthly
    // payout run and any "you never paid me" dispute are settled against.
    // Marking one paid is called out from a plain edit so the money-affecting
    // action is greppable on its own.
    await logAdminAction({
      actor, req,
      action: body.status === 'paid' ? 'store_payment.mark_paid' : 'store_payment.update',
      target: payment.id,
      meta: {
        storeId:     body.storeId,
        month:       body.month,
        status:      body.status,
        amountPaise: payment.amountPaise,
        payRef:      body.payRef ?? null,
        // The derivation, so the trail explains the figure without a join.
        // Plain names on purpose — admin-audit scrubs any meta name whose words
        // include key/hash/sig/pin, which would blank these out silently.
        basePaise:        breakdown?.basePaise ?? null,
        incentivePaise:   breakdown?.incentivePaise ?? null,
        electricityPaise: breakdown?.electricityPaise ?? null,
        kwhSource:        breakdown?.kwhSource ?? null,
        brandsPlayed:     breakdown?.brandsPlayed ?? null,
        // An amount that is NOT the computed one is the single most important
        // thing a later auditor needs to see.
        override:      override != null,
        computedPaise: computedPaise,
        // True when this write touched an already-settled month, whose frozen
        // breakdown was deliberately left alone.
        alreadySettled: settled,
      },
    });

    return NextResponse.json(payment);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
