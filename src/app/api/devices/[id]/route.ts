// PATCH /api/devices/[id] — update storeName / groupName
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { storeName, groupName } = await req.json() as { storeName?: string; groupName?: string };
    const data: Record<string, string | null> = {};
    if (storeName?.trim()) data.name = storeName.trim();
    if (groupName !== undefined) data.groupName = groupName?.trim() || null;

    const raw    = await db.device.update({ where: { id }, data });
    const device = { ...raw, storeName: raw.name };
    return NextResponse.json({ device });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
