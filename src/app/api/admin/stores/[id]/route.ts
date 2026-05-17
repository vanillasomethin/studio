import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json() as {
      liveAt?: string | null;
      onboardingStage?: string;
      payoutStatus?: string;
      payoutNotes?: string;
    };

    // Build only the columns we're allowed to update
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if ('liveAt' in body) {
      setClauses.push(`"liveAt" = $${values.length + 1}`);
      values.push(body.liveAt ? new Date(body.liveAt) : null);
    }
    if (body.onboardingStage) {
      setClauses.push(`"onboardingStage" = $${values.length + 1}`);
      values.push(body.onboardingStage);
    }
    if (body.payoutStatus) {
      setClauses.push(`"payoutStatus" = $${values.length + 1}`);
      values.push(body.payoutStatus);
    }
    if ('payoutNotes' in body) {
      setClauses.push(`"payoutNotes" = $${values.length + 1}`);
      values.push(body.payoutNotes ?? null);
    }

    if (setClauses.length === 0) return NextResponse.json({ ok: true });

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    await db.$queryRawUnsafe(
      `UPDATE "Store" SET ${setClauses.join(', ')} WHERE "id" = $${values.length}`,
      ...values
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
