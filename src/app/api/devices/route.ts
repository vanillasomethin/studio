// GET /api/devices  — list all registered devices with status
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const devices = await db.device.findMany({
      orderBy: { claimedAt: 'desc' },
      select: {
        id:          true,
        hardwareKey: true,
        storeName:   true,
        storeId:     true,
        status:      true,
        lastSeen:    true,
        groupName:   true,
        claimedAt:   true,
      },
    });
    return NextResponse.json({ devices });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
