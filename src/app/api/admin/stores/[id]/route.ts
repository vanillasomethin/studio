import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Redis } from '@upstash/redis';
import { pushDecommission } from '@/lib/fcm';
import { deleteObject, publicUrl } from '@/lib/r2';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

/** R2 object key for a stored verification-photo URL, or null if it isn't one. */
function verificationKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const prefix = publicUrl('');
  if (!prefix || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.startsWith('verification/') ? key : null;
}

/**
 * The text columns ops may set. Column names come from this fixed list, never
 * from the request, so the raw UPDATE below stays injection-safe.
 */
const TEXT_COLS = [
  'tvBrand', 'tvModel', 'tvSerial', 'tvTag', 'espSwitchName', 'espPlugId',
  'wifiSsid', 'wifiUsername', 'wifiPassword', 'wifiAuthType', 'installNotes',
] as const;

/**
 * The stored form of a text column: trimmed, or null when blank. The stage gate
 * and the UPDATE both read every value through this one function, so what the
 * gate certifies as present is exactly what lands in the column. Non-string
 * values are rejected with a 400 before either runs (see PATCH).
 */
function textCol(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Panel size in inches, or null for blank/nonsense — one rule for gate and write. */
function tvSize(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 200 ? Math.round(n) : null;
}

/** The onboarding pipeline in order; 'rejected' sits deliberately outside it. */
const STAGE_ORDER = ['new', 'contacted', 'physically_onboarded', 'digitally_onboarded', 'live'] as const;

/**
 * Rank in the pipeline, or -1 for anything that isn't a pipeline stage
 * ('rejected', junk, non-strings). An array lookup rather than an object map: a
 * map answers for 'constructor' and every other Object.prototype key.
 */
function stageRank(v: unknown): number {
  return typeof v === 'string' ? (STAGE_ORDER as readonly string[]).indexOf(v) : -1;
}

/** Rank of the stage at which a screen starts earning, and liveAt is stamped. */
const LIVE_RANK = STAGE_ORDER.indexOf('live');

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;

  try {
    const body = await req.json() as {
      liveAt?: string | null;
      onboardingStage?: string;
      payoutStatus?: string;
      payoutNotes?: string;
      // Installation & hardware (see the Store model) — ops fills these at the site visit.
      tvBrand?: string | null;
      tvModel?: string | null;
      tvSerial?: string | null;
      tvSizeInches?: number | string | null;
      tvTag?: string | null;
      tvInstalledAt?: string | null;
      espSwitchName?: string | null;
      espPlugId?: string | null;
      wifiSsid?: string | null;
      wifiUsername?: string | null;
      wifiPassword?: string | null;
      wifiAuthType?: string | null;
      installNotes?: string | null;
    };

    // A text column is a string, or null/undefined to clear/leave it. Anything
    // else is refused here rather than coerced, because the gate and the write
    // cannot agree on it: a JSON-number serial ({"tvSerial": 123456789}) looked
    // present to the gate, crossed the store into 'physically_onboarded' and
    // stamped tvInstalledAt, then wrote tvSerial NULL — the exact empty install
    // record the gate exists to prevent, with the unique index inapplicable
    // because NULL was stored.
    for (const col of TEXT_COLS) {
      const raw: unknown = body[col];
      if (col in body && raw !== null && raw !== undefined && typeof raw !== 'string') {
        return NextResponse.json(
          { error: `"${col}" must be text — send it as a JSON string, or null to clear it.` },
          { status: 400 },
        );
      }
    }

    // Blank clears the field (same as every other text column); anything else
    // must be one of the four the gate below reasons about.
    const WIFI_AUTH_TYPES = ['wpa_psk', 'pppoe', 'portal', 'open'];
    const bodyAuthType = textCol(body.wifiAuthType);
    if (bodyAuthType && !WIFI_AUTH_TYPES.includes(bodyAuthType)) {
      return NextResponse.json(
        { error: `Unknown WiFi security type "${bodyAuthType}". Use one of: ${WIFI_AUTH_TYPES.join(', ')}.` },
        { status: 400 },
      );
    }

    // Only the six stages the admin panel offers may be stored. An unknown one
    // used to rank nowhere, which skipped the ENTIRE gate below, and was then
    // written verbatim — so 'physically_onboarded ' (trailing space) or
    // 'Physically_Onboarded' advanced a store ungated into a value that matches
    // none of the dashboards' stage comparisons.
    if (body.onboardingStage && stageRank(body.onboardingStage) < 0 && body.onboardingStage !== 'rejected') {
      return NextResponse.json(
        { error: `Unknown onboarding stage "${String(body.onboardingStage)}". Use one of: ${STAGE_ORDER.join(', ')}, rejected.` },
        { status: 400 },
      );
    }

    // ── Gates on stage advancement ───────────────────────────────────────────
    // The onboarding pipeline requires field evidence before milestones pass: a
    // GPS-tagged shop-front photo to cross INTO 'contacted' (Team
    // verification), and the complete site-install record — TV identity, smart
    // plug, network and three photos — to cross INTO 'physically_onboarded' or
    // beyond (Site visit & install). Gates fire only on FORWARD crossings of
    // those milestones — re-saving the current stage (the admin Save button
    // always sends it), demoting, 'rejected', and stores already past a
    // milestone (the pre-feature fleet) are unaffected.
    // 'rejected' and an absent stage both rank -1, so they skip the gate exactly
    // as they did when they ranked `undefined`.
    const targetRank = body.onboardingStage ? stageRank(body.onboardingStage) : -1;
    let stampInstalledAt = false;
    let stampLiveAt = false;
    if (targetRank >= 1) {
      try {
        const rows = await db.$queryRaw<{
          onboardingStage: string | null;
          shopPhotoUrl: string | null; installPhotoUrl: string | null;
          serialPhotoUrl: string | null; plugPhotoUrl: string | null;
          tvBrand: string | null; tvModel: string | null; tvSerial: string | null;
          tvSizeInches: number | null; tvTag: string | null; tvInstalledAt: Date | null;
          espPlugId: string | null; wifiSsid: string | null;
          wifiUsername: string | null; wifiPassword: string | null; wifiAuthType: string | null;
          liveAt: Date | null;
        }[]>`
          SELECT "onboardingStage", "shopPhotoUrl", "installPhotoUrl", "serialPhotoUrl", "plugPhotoUrl",
                 "tvBrand", "tvModel", "tvSerial", "tvSizeInches", "tvTag", "tvInstalledAt",
                 "espPlugId", "wifiSsid", "wifiUsername", "wifiPassword", "wifiAuthType",
                 "liveAt"
            FROM "Store" WHERE "id" = ${id} LIMIT 1
        `;
        const p = rows[0];
        // A stored 'rejected' or a stale/unknown value counts as rank 0, so the
        // gate still fires on the way forward out of it.
        const currentRank = p ? Math.max(stageRank(p.onboardingStage ?? 'new'), 0) : 0;
        if (p && currentRank < 1 && targetRank >= 1 && !p.shopPhotoUrl) {
          return NextResponse.json(
            { error: 'Cannot advance stage: the partner has not uploaded the GPS shop-front photo yet (required for Team verification).',
              missing: ['Photo of the shop front'] },
            { status: 409 },
          );
        }
        if (p && currentRank < 2 && targetRank >= 2) {
          // Checked against the values this save will LEAVE behind, not the
          // stored row: the panel sends the install fields and the stage in one
          // PATCH, so a row-only check would reject the very save that fills
          // them in. Photos are never in the body — they arrive via
          // POST .../photo — so the row is the only truth for those.
          const after = { ...p, ...body } as Record<string, unknown>;
          const authType = textCol(after.wifiAuthType);
          const missing: string[] = [];
          if (!textCol(after.tvSerial)) missing.push('TV serial number');
          if (!textCol(after.tvBrand)) missing.push('TV company');
          if (!textCol(after.tvModel)) missing.push('TV model');
          if (tvSize(after.tvSizeInches) === null) missing.push('TV size');
          if (!textCol(after.tvTag)) missing.push('TV number / tag');
          if (!textCol(after.espPlugId)) missing.push('Smart plug ID');
          if (!textCol(after.wifiSsid)) missing.push('WiFi network name');
          if (!authType) missing.push('WiFi security type');
          if (authType !== 'open' && !textCol(after.wifiPassword)) missing.push('WiFi password');
          if ((authType === 'pppoe' || authType === 'portal') && !textCol(after.wifiUsername)) missing.push('WiFi username');
          if (!p.installPhotoUrl) missing.push('Photo of the installed TV');
          if (!p.serialPhotoUrl) missing.push('Photo of the serial plate');
          if (!p.plugPhotoUrl) missing.push('Photo of the smart plug');
          // Every miss at once — the executive is standing in the shop and must
          // see the whole list, not discover it one round trip at a time.
          if (missing.length) {
            return NextResponse.json(
              { error: `Cannot advance stage: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still missing (required for Site visit & install).`,
                missing },
              { status: 409 },
            );
          }
          stampInstalledAt = !p.tvInstalledAt;
        }

        // Crossing into 'live' is the moment the screen starts earning, and
        // liveAt is what the payout export bills from. Nothing ever set it:
        // the only writer was an admin typing a date into the "Set live date"
        // modal in the Payments tab, so a store walked all the way to 'live'
        // with liveAt still NULL and simply never appeared in an export.
        // Every other consumer reads `stage === 'live' || liveAt` and so looked
        // correct, which is why this stayed invisible.
        //
        // Same reasoning as tvInstalledAt above: the executive is standing in
        // the shop, so do not make a human remember to type today's date.
        //
        // Gated on the crossing, not merely on the target, so a re-save of a
        // store that has been live for months cannot stamp today over its real
        // start date — a wrong date silently enters the payout maths, which is
        // worse than a NULL that is visibly wrong. Rows already at 'live' with
        // a NULL liveAt therefore still need the modal once.
        if (p && currentRank < LIVE_RANK && targetRank >= LIVE_RANK) {
          stampLiveAt = !p.liveAt;
        }
      } catch (e) {
        // Fail open ONLY for the not-yet-migrated-columns case; any other DB
        // error must not silently disable the gate — rethrow so the save fails
        // loudly instead of advancing ungated.
        const msg = (e as Error).message ?? '';
        if (!/column .* does not exist|42703/i.test(msg)) throw e;
        console.error('photo-gate: columns missing, failing open:', msg.slice(0, 200));
      }
    }

    // Build only the columns we're allowed to update
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if ('liveAt' in body || stampLiveAt) {
      const d = body.liveAt ? new Date(body.liveAt) : null;
      // A cleared or absent date on a successful crossing stamps itself; an
      // explicit date always wins, so the Payments-tab modal can still correct
      // a store that went live before this was recorded. An unparseable date
      // falls through to the stamp rather than writing Invalid Date.
      setClauses.push(`"liveAt" = $${values.length + 1}`);
      values.push(d && !isNaN(d.getTime()) ? d : (stampLiveAt ? new Date() : null));
    }
    if (body.onboardingStage) {
      setClauses.push(`"onboardingStage" = $${values.length + 1}`);
      values.push(body.onboardingStage);
    }
    if (body.payoutStatus) {
      setClauses.push(`"payoutStatus" = $${values.length + 1}`);
      values.push(body.payoutStatus);
    }
    if ('payoutNotes' in body) {
      setClauses.push(`"payoutNotes" = $${values.length + 1}`);
      values.push(body.payoutNotes ?? null);
    }

    // ── Installation & hardware ──────────────────────────────────────────────
    // Same textCol() the gate above read these through, so the row ends up
    // holding exactly what the gate certified. Blank strings become NULL, so
    // clearing a field in the panel actually clears it.
    for (const col of TEXT_COLS) {
      if (col in body) {
        setClauses.push(`"${col}" = $${values.length + 1}`);
        values.push(textCol(body[col]));
      }
    }
    if ('tvSizeInches' in body) {
      setClauses.push(`"tvSizeInches" = $${values.length + 1}`);
      values.push(tvSize(body.tvSizeInches));
    }
    if ('tvInstalledAt' in body || stampInstalledAt) {
      const d = body.tvInstalledAt ? new Date(body.tvInstalledAt) : null;
      // A cleared date on a successful crossing stamps itself: the executive is
      // standing in the shop, so never make a human type today's date. An
      // already-recorded install date is left alone (stampInstalledAt is false).
      setClauses.push(`"tvInstalledAt" = $${values.length + 1}`);
      values.push(d && !isNaN(d.getTime()) ? d : (stampInstalledAt ? new Date() : null));
    }

    if (setClauses.length === 0) return NextResponse.json({ ok: true });

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    try {
      await db.$queryRawUnsafe(
        `UPDATE "Store" SET ${setClauses.join(', ')} WHERE "id" = $${values.length}`,
        ...values
      );
    } catch (e) {
      // One physical panel, one store (Store_tvSerial_key). tvSerial is the only
      // unique column this UPDATE touches, so a 23505 here is always that — name
      // the store already holding the serial instead of answering a bare 500.
      const serial = textCol(body.tvSerial);
      if (!serial || !/Store_tvSerial_key|23505/.test((e as Error).message ?? '')) throw e;
      const owner = await db.$queryRaw<{ storeName: string }[]>`
        SELECT "storeName" FROM "Store" WHERE "tvSerial" = ${serial} AND "id" <> ${id} LIMIT 1
      `;
      return NextResponse.json(
        { error: `TV serial ${serial} is already recorded at ${owner[0]?.storeName ?? 'another store'}. Clear it there first if the TV was moved.` },
        { status: 409 },
      );
    }

    // Stage advancement is the field-ops milestone money hangs off (a store
    // reaching 'live' starts earning), so record who moved it and which columns
    // the save touched. Only the changed field NAMES — the body carries the
    // store's WiFi credentials.
    await logAdminAction({
      actor, req,
      action: 'store.update',
      target: id,
      meta: {
        onboardingStage: body.onboardingStage ?? null,
        payoutStatus:    body.payoutStatus ?? null,
        fields:          Object.keys(body),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    // Find the store to get userId before deleting
    const rows = await db.$queryRaw<Array<{ userId: string; whatsapp: string }>>`
      SELECT "userId", "whatsapp" FROM "Store" WHERE "id" = ${id}
    `;
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { userId } = rows[0];

    // The store's devices are about to cascade away with it — capture their FCM
    // tokens first so we can tell those screens to decommission (wipe + re-pair)
    // immediately, same as a direct screen delete via /api/devices/bulk. Screens
    // that miss the push converge via the 410 the device API answers next poll.
    const doomedDevices = await db.device.findMany({
      where:  { storeId: id, fcmToken: { not: null } },
      select: { fcmToken: true },
    });

    // Capture verification-photo keys before the row vanishes so the R2
    // objects can be removed too (tolerant of the columns not existing yet).
    let photoKeys: string[] = [];
    try {
      const ph = await db.$queryRaw<{ shopPhotoUrl: string | null; installPhotoUrl: string | null; serialPhotoUrl: string | null; plugPhotoUrl: string | null }[]>`
        SELECT "shopPhotoUrl", "installPhotoUrl", "serialPhotoUrl", "plugPhotoUrl" FROM "Store" WHERE "id" = ${id} LIMIT 1
      `;
      photoKeys = [ph[0]?.shopPhotoUrl, ph[0]?.installPhotoUrl, ph[0]?.serialPhotoUrl, ph[0]?.plugPhotoUrl]
        .map((u) => verificationKeyFromUrl(u ?? null))
        .filter((k): k is string => !!k);
    } catch { /* columns not yet migrated */ }

    // Delete store (cascades to StorePayment, StoreOffer, Bill, Device via FK)
    // and the user account atomically — a surviving User with no Store leaves
    // a login that 401s on every store API forever.
    await db.$transaction([
      db.$executeRaw`DELETE FROM "Store" WHERE "id" = ${id}`,
      db.$executeRaw`DELETE FROM "User" WHERE "id" = ${userId}`,
    ]);

    // Logged the moment the rows are gone, not at the end: the cleanup below can
    // throw, and an irreversible cascade delete must never go unrecorded because
    // a best-effort push failed. Counts only — the store row no longer exists.
    await logAdminAction({
      actor, req,
      action: 'store.delete',
      target: id,
      meta:   { userId, devices: doomedDevices.length, photos: photoKeys.length },
    });

    await pushDecommission(doomedDevices.map((d) => d.fcmToken!));
    for (const key of photoKeys) await deleteObject(key).catch(() => { /* best-effort */ });

    // Remove from Redis index (non-fatal)
    try {
      const kv = getRedis();
      if (kv) {
        const ids: string[] = (await kv.get<string[]>('stores:index')) ?? [];
        await kv.set('stores:index', ids.filter((x) => x !== id));
        await kv.del(`store:${id}`);
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
