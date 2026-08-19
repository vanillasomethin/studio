// GET  /api/admin/slot-requests?status=pending  — list (default: pending only)
// POST /api/admin/slot-requests { id, decision: 'approved'|'rejected', decidedBy? }
// Auth: admin-password header.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decideSlotRequest } from '@/lib/slot-requests-db';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const requests = await db.slotRequest.findMany({
    where: status === 'all' ? {} : { status },
    orderBy: { requestedAt: 'desc' },
    take: 100,
    include: {
      campaign: { select: { name: true, email: true, brand: { select: { brandName: true } } } },
      store: { select: { storeName: true, city: true, loopSlotCount: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id, campaignId: r.campaignId,
      brandName: r.campaign.brand?.brandName ?? r.campaign.name,
      storeId: r.storeId, storeName: r.store.storeName, city: r.store.city,
      window: r.window, creditsCost: r.creditsCost, status: r.status, note: r.note,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null, decidedBy: r.decidedBy,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { id?: string; decision?: string; decidedBy?: string } | null;
  const id = body?.id ?? '';
  if (!id || (body?.decision !== 'approved' && body?.decision !== 'rejected')) {
    return NextResponse.json({ error: "id and decision ('approved'|'rejected') required" }, { status: 400 });
  }

  const ok = await decideSlotRequest(id, body.decision, body.decidedBy?.trim() || null);
  if (!ok) return NextResponse.json({ error: 'Request not found or already decided' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
