// DELETE /api/stores/offers/[id]  — soft-delete (set active=false)
// Auth: store session required

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const store = await db.store.findUnique({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  // Verify ownership before deleting
  const offer = await db.storeOffer.findFirst({ where: { id, storeId: store.id } });
  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.storeOffer.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
