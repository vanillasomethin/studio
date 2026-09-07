import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { isTuyaConfigured, listTuyaDevices } from '@/lib/tuya';

// Every device on the linked Smart Life account, annotated with the store each
// one is already linked to — feeds the "Link Aziot plug" picker in the admin
// store card. `configured:false` (not an error) when the Tuya project env vars
// are absent, so the panel can explain the setup instead of failing.

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  if (!isTuyaConfigured()) {
    return NextResponse.json({ configured: false, devices: [] });
  }

  try {
    const [devices, plugs] = await Promise.all([
      listTuyaDevices(),
      db.smartPlug.findMany({ select: { tuyaDeviceId: true, store: { select: { id: true, storeName: true } } } }),
    ]);
    const linkedBy = new Map(plugs.map((p) => [p.tuyaDeviceId, p.store]));
    return NextResponse.json({
      configured: true,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        online: !!d.online,
        category: d.category ?? null,
        productName: d.product_name ?? null,
        linkedStoreId: linkedBy.get(d.id)?.id ?? null,
        linkedStoreName: linkedBy.get(d.id)?.storeName ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: `Tuya cloud error: ${(e as Error).message}` }, { status: 502 });
  }
}
