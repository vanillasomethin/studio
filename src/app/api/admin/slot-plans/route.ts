// Standing slot assignments — "this brand plays N times a day at this store, from
// D, until stopped".
//
// GET    /api/admin/slot-plans?storeId=…      → { plans: [...] }
// POST   /api/admin/slot-plans                → create or update (one per store+campaign)
// PATCH  /api/admin/slot-plans                → { id, slotsPerDay?, active?, endDate? }
// DELETE /api/admin/slot-plans?id=…           → remove
//
// A plan never consumes sellable inventory (see the SlotPlan model comment), so
// unlike SlotBooking there is no availability check here — a plan simply takes
// whatever positions are left after sold bookings on any given day.
//
// Auth: admin session. Mutations push plan_updated to the store's devices.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { istToday, uniformSlotSpan } from '@/lib/slots';
import { campaignCreatives, CAMPAIGN_SLOT_CREATIVES_SELECT } from '@/lib/slots-db';
import { pushPlanUpdated } from '@/lib/fcm';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const MAX_SLOTS_PER_DAY = 100;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function pushStoreDevices(storeId: string) {
  const devices = await db.device.findMany({ where: { storeId }, select: { id: true } });
  await pushPlanUpdated(devices.map((d) => d.id));
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const storeId = req.nextUrl.searchParams.get('storeId');
    const plans = await db.slotPlan.findMany({
      where:   storeId ? { storeId } : {},
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, storeId: true, campaignId: true, slotsPerDay: true,
        startDate: true, endDate: true, active: true,
        store:    { select: { storeName: true } },
        campaign: { select: { name: true, status: true, brand: { select: { brandName: true } } } },
      },
    });

    return NextResponse.json({
      plans: plans.map((p) => ({
        id: p.id, storeId: p.storeId, campaignId: p.campaignId,
        storeName: p.store.storeName,
        brandName: p.campaign.brand?.brandName ?? p.campaign.name ?? 'A brand',
        campaignStatus: p.campaign.status,
        slotsPerDay: p.slotsPerDay,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate:   p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
        active:    p.active,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as {
      storeId?: string; campaignId?: string; slotsPerDay?: number;
      startDate?: string; endDate?: string | null;
    };
    const { storeId, campaignId } = body;
    if (!storeId || !campaignId) {
      return NextResponse.json({ error: 'storeId and campaignId required' }, { status: 400 });
    }
    const slotsPerDay = Math.floor(Number(body.slotsPerDay ?? 1));
    if (!Number.isFinite(slotsPerDay) || slotsPerDay < 1 || slotsPerDay > MAX_SLOTS_PER_DAY) {
      return NextResponse.json({ error: `slotsPerDay must be 1–${MAX_SLOTS_PER_DAY}` }, { status: 400 });
    }
    if (body.endDate != null && !isDate(body.endDate)) {
      return NextResponse.json({ error: 'endDate must be YYYY-MM-DD or null' }, { status: 400 });
    }
    const startDate = isDate(body.startDate) ? body.startDate : istToday();
    if (body.endDate && body.endDate < startDate) {
      return NextResponse.json({ error: 'endDate is before startDate' }, { status: 400 });
    }

    const store = await db.store.findUnique({
      where: { id: storeId }, select: { id: true, loopSlotCount: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (store.loopSlotCount == null) {
      return NextResponse.json({ error: 'Store is not in slot mode' }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, ...CAMPAIGN_SLOT_CREATIVES_SELECT },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'cancelled') {
      return NextResponse.json({ error: 'Campaign is cancelled — pick another' }, { status: 400 });
    }

    // A plan fills ONE scattered position at a time, so a creative needing a
    // multi-slot window can only ever render truncated. Refuse it here rather than
    // let the loop builder silently drop the plan every single day.
    const creatives = campaignCreatives(campaign);
    if (creatives.length === 0) {
      return NextResponse.json({ error: 'Campaign has no slot creative to play' }, { status: 400 });
    }
    const spanned = uniformSlotSpan(creatives);
    if ('error' in spanned) return NextResponse.json({ error: spanned.error }, { status: 400 });
    if (spanned.span > 1) {
      return NextResponse.json({
        error: 'Standing assignments are 10s only — a longer ad needs a dated booking so its whole window can be reserved.',
      }, { status: 400 });
    }

    // Upsert on the unique (storeId, campaignId): raising the rate is an edit, not a
    // second row that would silently double the brand's plays.
    const plan = await db.slotPlan.upsert({
      where:  { storeId_campaignId: { storeId, campaignId } },
      create: {
        storeId, campaignId, slotsPerDay,
        startDate: new Date(`${startDate}T00:00:00Z`),
        endDate:   body.endDate ? new Date(`${body.endDate}T00:00:00Z`) : null,
        active:    true,
      },
      update: {
        slotsPerDay,
        startDate: new Date(`${startDate}T00:00:00Z`),
        endDate:   body.endDate ? new Date(`${body.endDate}T00:00:00Z`) : null,
        active:    true,
      },
      select: { id: true, slotsPerDay: true, startDate: true, endDate: true, active: true },
    });

    await logAdminAction({
      actor, req, action: 'slotPlan.upsert', target: plan.id,
      meta: { storeId, campaignId, slotsPerDay, startDate, endDate: body.endDate ?? null },
    });
    await pushStoreDevices(storeId);

    return NextResponse.json({ plan: {
      id: plan.id, slotsPerDay: plan.slotsPerDay, active: plan.active,
      startDate: plan.startDate.toISOString().slice(0, 10),
      endDate:   plan.endDate ? plan.endDate.toISOString().slice(0, 10) : null,
    } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const { id, slotsPerDay, active, endDate } = await req.json() as {
      id?: string; slotsPerDay?: number; active?: boolean; endDate?: string | null;
    };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (slotsPerDay !== undefined) {
      const n = Math.floor(Number(slotsPerDay));
      if (!Number.isFinite(n) || n < 1 || n > MAX_SLOTS_PER_DAY) {
        return NextResponse.json({ error: `slotsPerDay must be 1–${MAX_SLOTS_PER_DAY}` }, { status: 400 });
      }
    }
    if (endDate != null && !isDate(endDate)) {
      return NextResponse.json({ error: 'endDate must be YYYY-MM-DD or null' }, { status: 400 });
    }

    const existing = await db.slotPlan.findUnique({ where: { id }, select: { storeId: true } });
    if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const updated = await db.slotPlan.update({
      where: { id },
      data: {
        ...(slotsPerDay !== undefined ? { slotsPerDay: Math.floor(Number(slotsPerDay)) } : {}),
        ...(active      !== undefined ? { active } : {}),
        // undefined leaves the end date alone; null clears it back to open-ended.
        ...(endDate     !== undefined ? { endDate: endDate ? new Date(`${endDate}T00:00:00Z`) : null } : {}),
      },
      select: { id: true, slotsPerDay: true, active: true, endDate: true },
    });

    await logAdminAction({ actor, req, action: 'slotPlan.update', target: id, meta: { slotsPerDay, active, endDate } });
    await pushStoreDevices(existing.storeId);

    return NextResponse.json({ plan: {
      id: updated.id, slotsPerDay: updated.slotsPerDay, active: updated.active,
      endDate: updated.endDate ? updated.endDate.toISOString().slice(0, 10) : null,
    } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await db.slotPlan.findUnique({ where: { id }, select: { storeId: true, campaignId: true } });
    if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    await db.slotPlan.delete({ where: { id } });
    await logAdminAction({ actor, req, action: 'slotPlan.delete', target: id, meta: { ...existing } });
    await pushStoreDevices(existing.storeId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
