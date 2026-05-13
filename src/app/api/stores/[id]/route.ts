import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json() as {
      onboardingStage?: string; payoutStatus?: string; payoutMethod?: string;
      upiId?: string; bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
      payoutLastPaidAt?: string | null; payoutNotes?: string | null;
    };

    const updated = await db.store.update({
      where: { id },
      data: {
        onboardingStage: body.onboardingStage,
        payoutStatus: body.payoutStatus,
        payoutMethod: body.payoutMethod || null,
        upiId: body.upiId || null,
        bankAccountName: body.bankAccountName || null,
        bankAccountNo: body.bankAccountNo || null,
        bankIfsc: body.bankIfsc || null,
        bankName: body.bankName || null,
        payoutLastPaidAt: body.payoutLastPaidAt ? new Date(body.payoutLastPaidAt) : null,
        payoutNotes: body.payoutNotes || null,
      },
    });

    return NextResponse.json({ success: true, store: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
