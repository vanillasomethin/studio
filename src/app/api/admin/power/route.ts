// Fleet electricity estimates + screen survey data.
// GET   /api/admin/power?month=YYYY-MM → per-store estimate, screen details, device info
// PATCH /api/admin/power  { storeId, screenWatts?, screenModel?, screenPlatePhotoUrl?,
//                           screenRatingPhotoUrl? }        — record a store's survey
//       /api/admin/power  { defaultScreenWatts?, electricityPaisePerKwh? } — fleet settings
// Auth: named admin session (requireAdmin)
//
// Estimates, not meter readings — see lib/power.ts. `usingDefaultWatts` marks the
// stores still on the fleet guess, i.e. the ones whose numbers should not be trusted
// until someone surveys the screen.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { estimateStorePower, getPowerSettings } from '@/lib/power-db';
import { istMonthStart } from '@/lib/power';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';


export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const monthParam = req.nextUrl.searchParams.get('month');
    const since = /^\d{4}-\d{2}$/.test(monthParam ?? '')
      ? new Date(`${monthParam}-01T00:00:00+05:30`)
      : istMonthStart();

    const stores = await db.store.findMany({
      select: {
        id: true, storeName: true, city: true,
        screenWatts: true, screenModel: true, screenSurveyedAt: true,
        screenPlatePhotoUrl: true, screenRatingPhotoUrl: true,
        devices: {
          select: {
            id: true, name: true, status: true, lastSeen: true,
            androidVersion: true, appVersion: true, orientation: true,
            freeStorageMb: true, cpuTempC: true,
          },
        },
      },
      orderBy: [{ city: 'asc' }, { storeName: 'asc' }],
    });

    const estimates = await estimateStorePower(
      stores.map((s) => ({ id: s.id, screenWatts: s.screenWatts })),
      since,
    );
    const settings = await getPowerSettings();

    return NextResponse.json({
      since: since.toISOString(),
      settings,
      stores: stores.map((s) => {
        const e = estimates.get(s.id)!;
        return {
          id: s.id, storeName: s.storeName, city: s.city,
          screen: {
            model:          s.screenModel,
            watts:          s.screenWatts,
            surveyedAt:     s.screenSurveyedAt?.toISOString() ?? null,
            platePhotoUrl:  s.screenPlatePhotoUrl,
            ratingPhotoUrl: s.screenRatingPhotoUrl,
          },
          devices: s.devices.map((d) => ({
            ...d, lastSeen: d.lastSeen?.toISOString() ?? null,
          })),
          estimate: {
            onHours:   Number(e.onHours.toFixed(1)),
            units:     Number(e.kwh.toFixed(2)),
            costPaise: e.costPaise,
            watts:     e.watts,
            usingDefaultWatts: e.usingDefaultWatts,
            source:    e.source,
          },
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

type PatchBody = {
  storeId?:              string;
  screenWatts?:          number | null;
  screenModel?:          string | null;
  screenPlatePhotoUrl?:  string | null;
  screenRatingPhotoUrl?: string | null;
  defaultScreenWatts?:     number;
  electricityPaisePerKwh?: number;
};

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as PatchBody;

    if (body.defaultScreenWatts !== undefined || body.electricityPaisePerKwh !== undefined) {
      if (body.defaultScreenWatts !== undefined &&
          (!Number.isInteger(body.defaultScreenWatts) || body.defaultScreenWatts < 1 || body.defaultScreenWatts > 1000)) {
        return NextResponse.json({ error: 'defaultScreenWatts must be 1–1000' }, { status: 400 });
      }
      if (body.electricityPaisePerKwh !== undefined &&
          (!Number.isInteger(body.electricityPaisePerKwh) || body.electricityPaisePerKwh < 1 || body.electricityPaisePerKwh > 10_000)) {
        return NextResponse.json({ error: 'electricityPaisePerKwh must be 1–10000 (paise per unit)' }, { status: 400 });
      }
      const settings = await db.playerConfig.upsert({
        where:  { id: 1 },
        update: {
          ...(body.defaultScreenWatts     !== undefined ? { defaultScreenWatts:     body.defaultScreenWatts }     : {}),
          ...(body.electricityPaisePerKwh !== undefined ? { electricityPaisePerKwh: body.electricityPaisePerKwh } : {}),
        },
        create: {
          id: 1,
          ...(body.defaultScreenWatts     !== undefined ? { defaultScreenWatts:     body.defaultScreenWatts }     : {}),
          ...(body.electricityPaisePerKwh !== undefined ? { electricityPaisePerKwh: body.electricityPaisePerKwh } : {}),
        },
        select: { defaultScreenWatts: true, electricityPaisePerKwh: true },
      });
      return NextResponse.json({ settings });
    }

    if (!body.storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    if (body.screenWatts != null &&
        (!Number.isInteger(body.screenWatts) || body.screenWatts < 1 || body.screenWatts > 1000)) {
      return NextResponse.json({ error: 'screenWatts must be 1–1000 (or null to use the fleet default)' }, { status: 400 });
    }

    const surveyed = body.screenWatts != null || body.screenModel
      || body.screenPlatePhotoUrl || body.screenRatingPhotoUrl;

    const store = await db.store.update({
      where: { id: body.storeId },
      data: {
        ...(body.screenWatts          !== undefined ? { screenWatts:          body.screenWatts }          : {}),
        ...(body.screenModel          !== undefined ? { screenModel:          body.screenModel }          : {}),
        ...(body.screenPlatePhotoUrl  !== undefined ? { screenPlatePhotoUrl:  body.screenPlatePhotoUrl }  : {}),
        ...(body.screenRatingPhotoUrl !== undefined ? { screenRatingPhotoUrl: body.screenRatingPhotoUrl } : {}),
        ...(surveyed ? { screenSurveyedAt: new Date() } : {}),
      },
      select: {
        id: true, screenWatts: true, screenModel: true, screenSurveyedAt: true,
        screenPlatePhotoUrl: true, screenRatingPhotoUrl: true,
      },
    });
    return NextResponse.json({ store });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
