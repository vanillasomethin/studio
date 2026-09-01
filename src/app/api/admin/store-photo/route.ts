// PATCH /api/admin/store-photo { storeId, photoUrl } — set/clear a store's
// storefront photo. The bytes themselves go to R2 via /api/admin/r2-upload;
// this only records the resulting public URL against the store.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as { storeId?: string; photoUrl?: string | null } | null;
  const storeId = body?.storeId?.trim();
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 });

  // Empty string clears the photo; anything else must look like a URL.
  const raw = body?.photoUrl ?? null;
  const photoUrl = raw && raw.trim() ? raw.trim() : null;
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    return NextResponse.json({ error: 'photoUrl must be an http(s) URL' }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  await db.store.update({ where: { id: storeId }, data: { photoUrl } });
  await logAdminAction({
    actor, req,
    action: photoUrl ? 'store.photo_set' : 'store.photo_cleared',
    target: storeId,
    meta:   { photoUrl },
  });
  return NextResponse.json({ photoUrl });
}
