import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteObject, putObject, publicUrl } from '@/lib/r2';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import crypto from 'crypto';

/** R2 object key for a stored verification-photo URL, or null if it isn't one. */
function verificationKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const prefix = publicUrl('');
  if (!prefix || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.startsWith('verification/') ? key : null;
}

// Column prefix per kind. Doubles as the allow-list that makes the prefix safe
// to interpolate into the raw SQL below.
const COLUMN_PREFIX = {
  shop:    'shopPhoto',
  install: 'installPhoto',
  serial:  'serialPhoto',
  plug:    'plugPhoto',
} as const;
type Kind = keyof typeof COLUMN_PREFIX;

export const maxDuration = 60;

// POST /api/admin/stores/[id]/photo — ops-captured install evidence upload.
// Auth: admin-password header.
//
// The admin twin of /api/stores/verification-photo: same R2 key scheme and
// same five columns per photo, but ops uploads on the partner's behalf during
// the site visit, and two of the four kinds ('serial', 'plug') only ever come
// from ops — a partner has no reason to photograph a back-panel plate.
//
// FormData fields:
//   file    File     required — JPEG/PNG/WebP, max 4 MB
//   kind    string   required — 'shop' | 'install' | 'serial' | 'plug'
//   lat/lng string   optional — decimal degrees; a serial plate is often shot
//                               indoors with no usable fix, so unlike the
//                               partner route these are not mandatory
//   source  string   optional — 'exif' | 'device' (where lat/lng came from)
//
// Returns { url, lat, lng, at }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const kind = form.get('kind') as string | null;

    // Object.hasOwn, not `in` — `in` walks the prototype chain, so kinds like
    // 'constructor' / '__proto__' / 'toString' would pass and yield a garbage
    // prefix that only fails at the UPDATE, after the object is already in R2.
    if (!kind || !Object.hasOwn(COLUMN_PREFIX, kind)) {
      return NextResponse.json({ error: "kind must be 'shop', 'install', 'serial' or 'plug'" }, { status: 400 });
    }
    const prefix = COLUMN_PREFIX[kind as Kind];

    if (!file || file.size === 0) return NextResponse.json({ error: 'file required' }, { status: 400 });
    // Vercel rejects a request body over ~4.5 MB before it reaches us, so cap
    // below that and say so — a phone photo that trips this was shot at full
    // sensor resolution and just needs retaking.
    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Photo too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 4 MB — the upload limit is ~4.5 MB per request.` },
        { status: 400 },
      );
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images allowed.' }, { status: 400 });
    }

    // Coordinates are optional only for the indoor kinds. 'shop' and 'install'
    // ARE the geo-tagged evidence: they gate the onboarding stage and stand as
    // the proof the visit happened where it claims. Accepting one without a fix
    // would write NULL over coordinates a partner had already captured — the
    // stage gate only checks that a URL exists, so the evidence would quietly
    // degrade to an untagged photo while still reading as verified.
    const REQUIRES_GPS: Record<Kind, boolean> = {
      shop: true, install: true, serial: false, plug: false,
    };

    let lat: number | null = null;
    let lng: number | null = null;
    let source: string | null = null;
    const latRaw = ((form.get('lat') as string | null) ?? '').trim();
    const lngRaw = ((form.get('lng') as string | null) ?? '').trim();
    const hasCoords = latRaw !== '' && lngRaw !== '';

    // Half a pair is not a fix. Number('') is 0, so accepting lat alone would
    // silently store lng = 0 — a point in the Gulf of Guinea, indistinguishable
    // later from a real reading.
    if (!hasCoords && (latRaw !== '' || lngRaw !== '')) {
      return NextResponse.json({ error: 'Send both lat and lng, or neither.' }, { status: 400 });
    }
    if (!hasCoords && REQUIRES_GPS[kind as Kind]) {
      return NextResponse.json(
        { error: `A ${kind} photo must carry GPS coordinates — it is the onboarding evidence. Enable location and retake.` },
        { status: 400 },
      );
    }

    if (hasCoords) {
      lat = Number(latRaw);
      lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
        return NextResponse.json({ error: 'Coordinates are invalid. Send both lat and lng, or neither.' }, { status: 400 });
      }
      const sourceRaw = (form.get('source') as string | null) ?? 'device';
      if (sourceRaw !== 'exif' && sourceRaw !== 'device') {
        return NextResponse.json({ error: "source must be 'exif' or 'device'" }, { status: 400 });
      }
      source = sourceRaw;
    }

    const store = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Store" WHERE "id" = ${id} LIMIT 1`;
    if (!store.length) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const ext   = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const key   = `verification/${id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();

    // Remember the photo being replaced (if any) so its R2 object can be
    // removed once the new one is committed — otherwise re-uploads orphan
    // objects in the bucket forever.
    let oldKey: string | null = null;
    try {
      const prev = await db.$queryRawUnsafe<{ url: string | null }[]>(
        `SELECT "${prefix}Url" AS url FROM "Store" WHERE "id" = $1 LIMIT 1`, id,
      );
      oldKey = verificationKeyFromUrl(prev[0]?.url ?? null);
    } catch { /* columns not yet migrated — nothing to replace */ }

    await putObject(key, Buffer.from(bytes), file.type);
    const url = publicUrl(key);

    const at = new Date();
    // Map pin. A store's pin comes from, in order: the partner at registration
    // → an on-site GPS fix that fills an EMPTY pin → ops setting or moving it
    // in Admin → Stores. Ops is standing in the shop, so any shop/install fix
    // qualifies here (EXIF or device); serial/plug never touch the pin.
    const fillsPin = kind === 'shop' || kind === 'install';
    let storeLat: number | null = null;
    let storeLng: number | null = null;
    try {
      // COALESCE, so a kind that legitimately has no fix (a serial plate shot
      // indoors) records the new photo without erasing coordinates already held
      // for it. A supplied pair still overwrites, which is what a re-shoot at
      // the real location should do. The pin, by contrast, is only ever FILLED
      // (both halves, in the one statement, so a stored lat never pairs with a
      // photo lng) — a pin that exists is left where the partner or ops put it.
      // RETURNING the pin the row now holds, so the panel can show the store
      // on the map the moment an upload has put it there.
      const rows = await db.$queryRawUnsafe<{ lat: number | null; lng: number | null }[]>(
        `UPDATE "Store" SET
           "${prefix}Url" = $1,
           "${prefix}Lat" = COALESCE($2, "${prefix}Lat"),
           "${prefix}Lng" = COALESCE($3, "${prefix}Lng"),
           "${prefix}Source" = COALESCE($4, "${prefix}Source"),
           "${prefix}At" = $5, "updatedAt" = $6,
           "lat" = CASE WHEN $8 AND $2 IS NOT NULL AND $3 IS NOT NULL AND ("lat" IS NULL OR "lng" IS NULL) THEN $2 ELSE "lat" END,
           "lng" = CASE WHEN $8 AND $2 IS NOT NULL AND $3 IS NOT NULL AND ("lat" IS NULL OR "lng" IS NULL) THEN $3 ELSE "lng" END
         WHERE "id" = $7
         RETURNING "lat", "lng"`,
        url, lat, lng, source, at, at, id, fillsPin,
      );
      storeLat = rows[0]?.lat ?? null;
      storeLng = rows[0]?.lng ?? null;
    } catch (e) {
      // DB write failed — don't leave the fresh object orphaned in R2.
      await deleteObject(key).catch(() => { /* best-effort */ });
      throw e;
    }

    if (oldKey && oldKey !== key) await deleteObject(oldKey).catch(() => { /* best-effort */ });

    // Logged after the row is committed, so a failed upload never reads as
    // recorded evidence. `replaced` matters: these photos are the onboarding
    // audit trail, and silently overwriting one is the interesting event.
    // `locationSource` records that the store's pin now equals this photo's
    // fix (filled by this upload, or already the same); the key deliberately
    // avoids the word "pin", which the audit scrubber redacts.
    const pinIsThisPhoto = fillsPin && lat != null && storeLat === lat && storeLng === lng;
    await logAdminAction({
      actor, req,
      action: 'store.upload_photo',
      target: id,
      meta:   {
        kind, lat, lng, source, replaced: !!(oldKey && oldKey !== key),
        locationSource: pinIsThisPhoto ? `${kind}_photo` : null,
      },
    });

    // storeLat/storeLng: the store's map pin after this upload (null = still unpinned).
    return NextResponse.json({ url, lat, lng, at, storeLat, storeLng });
  } catch (e) {
    // Log server-side; never return raw DB/R2 text, which leaks column names,
    // env-var names and bucket details. Matches the partner route's contract.
    console.error('admin store photo upload failed:', (e as Error).message);
    return NextResponse.json({ error: 'Upload failed on our side. Please try again in a moment.' }, { status: 500 });
  }
}
