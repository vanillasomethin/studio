// POST /api/devices/bulk  — bulk operations on multiple devices
// Body: { ids: string[]; action: 'group' | 'delete'; groupName?: string }
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { ids, action, groupName } = await req.json() as {
      ids:       string[];
      action:    'group' | 'delete';
      groupName?: string;
    };
    if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

    if (action === 'group') {
      await db.device.updateMany({
        where: { id: { in: ids } },
        data:  { groupName: groupName ?? null },
      });
      return NextResponse.json({ updated: ids.length });
    }

    if (action === 'delete') {
      await db.device.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ deleted: ids.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
