// POST /api/payout-claim — store partner requests monthly payout
// Auth: store session required
// Logs to AuditLog + notifies admin via WhatsApp

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyAdminWA, payoutClaimMsg } from '@/lib/notify';
import { withApiHandler } from '@/lib/with-api-handler';

export const POST = withApiHandler('/api/payout-claim', 'user', async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await req.json() as { month?: string };

  const store = await db.store.findUnique({
    where:   { userId: session.user.id },
    include: { user: { select: { phone: true } } },
  });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const claimMonth = month ?? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthlyRupees = Math.round((store.monthlyCompensationPaise ?? 50000) / 100);

  await db.auditLog.create({
    data: {
      actorId: session.user.id,
      action:  'PAYOUT_CLAIM',
      target:  store.id,
      meta:    { storeName: store.storeName, month: claimMonth, amount: `₹${monthlyRupees.toLocaleString('en-IN')} + electricity` },
    },
  });

  void notifyAdminWA(payoutClaimMsg({
    storeName: store.storeName,
    ownerName: store.ownerName,
    phone:     store.user?.phone ?? store.whatsapp,
    month:     claimMonth,
  }));

  return NextResponse.json({ ok: true, month: claimMonth });
});
