import { NextRequest, NextResponse } from 'next/server';
import { notifyAdminWA } from '@/lib/notify';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    await notifyAdminWA('Test alert from ALIVE admin panel. WhatsApp notifications are working.');

    // Sends a real outbound WhatsApp to the admin number, so it is a side effect
    // worth attributing — an unexplained alert should trace back to who fired it.
    await logAdminAction({
      actor, req,
      action: 'test_alert.send',
      meta:   { channel: 'whatsapp' },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
