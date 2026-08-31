import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

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

    const payment = await db.storePayment.upsert({
      where: { storeId_month: { storeId: body.storeId, month: body.month } },
      create: {
        storeId: body.storeId,
        month:   body.month,
        status:  body.status,
        amountPaise: body.amountPaise ?? 50000,
        paidAt:  body.paidAt ? new Date(body.paidAt) : (body.status === 'paid' ? new Date() : null),
        paidBy:  body.paidBy ?? null,
        payRef:  body.payRef ?? null,
        note:    body.note ?? null,
      },
      update: {
        status:  body.status,
        amountPaise: body.amountPaise ?? 50000,
        paidAt:  body.paidAt ? new Date(body.paidAt) : (body.status === 'paid' ? new Date() : undefined),
        paidBy:  body.paidBy ?? null,
        payRef:  body.payRef ?? null,
        note:    body.note ?? null,
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
      },
    });

    return NextResponse.json(payment);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
