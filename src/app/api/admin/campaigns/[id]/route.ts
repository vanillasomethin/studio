import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const deleted = await db.campaign.delete({ where: { id } });
    // A campaign row is a brand's paid booking — once deleted there is nothing
    // left to reconcile a billing dispute against, so capture it here.
    await logAdminAction({
      actor, req,
      action: 'campaign.delete',
      target: id,
      meta:   {
        name:        deleted.name,
        status:      deleted.status,
        brandId:     deleted.brandId,
        screens:     deleted.screens,
        months:      deleted.months,
        totalAmount: deleted.totalAmount,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
