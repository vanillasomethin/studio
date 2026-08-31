// POST /api/devices/bulk  — bulk operations on multiple devices
// Body: { ids: string[]; action: 'group' | 'delete'; groupName?: string }
// Auth: admin-password header

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pushDecommission } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { ids, action, groupName } = await req.json() as {
      ids:       string[];
      action:    'group' | 'delete';
      groupName?: string;
    };
    if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

    if (action === 'group') {
      const updated = await db.device.updateMany({
        where: { id: { in: ids } },
        data:  { groupName: groupName ?? null },
      });

      // Regrouping re-points every group-targeted schedule at a different set of
      // screens, so it changes what plays without touching a schedule at all.
      // No single target id — the ids live in meta.
      await logAdminAction({
        actor, req,
        action: 'device.group',
        meta:   { ids, groupName: groupName ?? null, matched: updated.count },
      });

      return NextResponse.json({ updated: ids.length });
    }

    if (action === 'delete') {
      // Capture FCM tokens BEFORE deleting — the rows are gone afterwards. The push
      // tells each screen to wipe its cached plan/media and return to pairing now;
      // screens that miss it (offline, FCM blocked) converge via the 410 the device
      // API answers on their next call.
      const doomed = await db.device.findMany({
        where:  { id: { in: ids }, fcmToken: { not: null } },
        select: { fcmToken: true },
      });
      const removed = await db.device.deleteMany({ where: { id: { in: ids } } });
      await pushDecommission(doomed.map((d) => d.fcmToken!));

      // Unpairing screens takes them dark until someone re-claims them — the
      // most disruptive fleet action there is. Logged with the exact id list.
      await logAdminAction({
        actor, req,
        action: 'device.delete',
        meta:   { ids, deleted: removed.count },
      });

      return NextResponse.json({ deleted: ids.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
