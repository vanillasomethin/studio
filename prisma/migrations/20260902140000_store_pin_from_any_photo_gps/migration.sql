-- Backfill Store.lat/lng from the onboarding photos' GPS fixes — any fix.
--
-- 20260902120000_store_pin_from_photo_gps filled empty pins from EXIF fixes
-- only, leaving stores whose photos carried a device (phone-location) fix off
-- the map until ops promoted the pin by hand. The rule is now: a store
-- onboarded with its GPS data is on the map automatically. The runtime routes
-- fill an empty pin from any shop/install fix as of the same change; this
-- covers the rows that were uploaded before it.
--
-- Same precedence as the runtime: the shop photo's fix first (it always
-- precedes the install photo in the pipeline), else the install photo's.
-- Pairwise — a pin is only ever a complete (lat, lng) from one photo. The
-- admin panel flags a photo-filled pin ("Pin taken from the … photo GPS —
-- confirm it on the map") so ops can check it by eye.
--
-- Idempotent: only rows still missing a half of the pin are touched, and a
-- second run finds none.
UPDATE "Store"
SET "lat" = CASE WHEN "shopPhotoLat" IS NOT NULL AND "shopPhotoLng" IS NOT NULL
                 THEN "shopPhotoLat" ELSE "installPhotoLat" END,
    "lng" = CASE WHEN "shopPhotoLat" IS NOT NULL AND "shopPhotoLng" IS NOT NULL
                 THEN "shopPhotoLng" ELSE "installPhotoLng" END,
    "updatedAt" = NOW()
WHERE ("lat" IS NULL OR "lng" IS NULL)
  AND (   ("shopPhotoLat"    IS NOT NULL AND "shopPhotoLng"    IS NOT NULL)
       OR ("installPhotoLat" IS NOT NULL AND "installPhotoLng" IS NOT NULL));
