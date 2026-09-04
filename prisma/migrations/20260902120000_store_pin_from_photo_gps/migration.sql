-- Backfill Store.lat/lng from the onboarding photos' GPS fixes.
--
-- THE RULE: a store's map pin comes from, in order, the partner's pin at
-- registration (now required) → an on-site GPS fix that fills an EMPTY pin (the
-- photo routes do this on upload from now on) → ops setting or moving it in
-- Admin → Stores → Edit → Map pin. A pin is required to cross into
-- physically_onboarded; a pinned store is on the public map once contacted, in
-- the brand picker once physically_onboarded, and on the admin monitoring map
-- at every stage. Nothing waits for live.
--
-- Rows onboarded before that rule have photos with coordinates but no pin.
-- This fills the pin, pairwise, with the same precedence the runtime uses:
-- the shop photo's EXIF fix first (the shop photo always precedes the install
-- photo in the pipeline), else the install photo's EXIF fix.
--
-- Only EXIF-sourced fixes are used. A 'device' fix is wherever the phone was at
-- upload time — for a partner uploading from home that is not the shop — so
-- those are left for ops to promote by hand from the Stores panel, where the
-- photo's coordinates sit next to the map.
--
-- Idempotent: only rows still missing a half of the pin are touched, and a
-- second run finds none.
UPDATE "Store"
SET "lat" = CASE WHEN "shopPhotoSource" = 'exif' AND "shopPhotoLat" IS NOT NULL AND "shopPhotoLng" IS NOT NULL
                 THEN "shopPhotoLat" ELSE "installPhotoLat" END,
    "lng" = CASE WHEN "shopPhotoSource" = 'exif' AND "shopPhotoLat" IS NOT NULL AND "shopPhotoLng" IS NOT NULL
                 THEN "shopPhotoLng" ELSE "installPhotoLng" END,
    "updatedAt" = NOW()
WHERE ("lat" IS NULL OR "lng" IS NULL)
  AND (   ("shopPhotoSource" = 'exif'    AND "shopPhotoLat"    IS NOT NULL AND "shopPhotoLng"    IS NOT NULL)
       OR ("installPhotoSource" = 'exif' AND "installPhotoLat" IS NOT NULL AND "installPhotoLng" IS NOT NULL));
