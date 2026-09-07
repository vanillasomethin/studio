-- Mandatory site-install capture: the fields the ops wizard at /admin/pair
-- collects while the field executive is standing in the shop, and which
-- /api/admin/stores/[id] now REQUIRES before a store can cross into
-- 'physically_onboarded' (SOP §5.1 step 12).
--
-- Extends 20260821090000_store_install_hardware. Same reasoning for living on
-- Store rather than Device: the decommission flow deletes the Device row, so
-- anything held there is lost on every re-pair.
--
-- All columns NULLABLE. "Mandatory" is enforced as a stage gate in the API, not
-- as NOT NULL — store registration (/api/stores/save) is a raw INSERT that lists
-- none of these columns, so a NOT NULL here would break every new signup, web
-- and mobile alike.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) to match house style — these run inside
-- the Vercel build, where a migration failure breaks the deploy.

ALTER TABLE "Store"
  -- TV asset identity beyond our own tag
  ADD COLUMN IF NOT EXISTS "tvModel"      TEXT,
  ADD COLUMN IF NOT EXISTS "tvSerial"     TEXT,
  -- Smart plug, typed from the plug's own label. Deliberately decoupled from
  -- "SmartPlug" (Device-keyed, needs a connected eWeLink account) so it can be
  -- filled at install time, before pairing or eWeLink linking.
  ADD COLUMN IF NOT EXISTS "espPlugId"    TEXT,
  -- WiFi: SSID + password already exist. Username/auth type cover PPPoE and
  -- ISP-login sites, where an SSID and passphrase alone will not connect.
  ADD COLUMN IF NOT EXISTS "wifiUsername" TEXT,
  ADD COLUMN IF NOT EXISTS "wifiAuthType" TEXT;

-- Two more GPS evidence photos, ops-captured (the existing shop/install pair is
-- partner-captured). Same five-column shape as shopPhoto*/installPhoto* so the
-- read path, the R2 cleanup on store delete, and the admin photo cards can treat
-- all four kinds identically.
ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "serialPhotoUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "serialPhotoLat"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "serialPhotoLng"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "serialPhotoSource" TEXT,
  ADD COLUMN IF NOT EXISTS "serialPhotoAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "plugPhotoUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "plugPhotoLat"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "plugPhotoLng"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "plugPhotoSource"   TEXT,
  ADD COLUMN IF NOT EXISTS "plugPhotoAt"       TIMESTAMP(3);

-- One physical panel, one store. Safe on a nullable column: Postgres treats
-- NULLs as distinct, so the entire existing fleet (all NULL) coexists. The API
-- turns the 23505 violation into a readable 409 naming the other store, rather
-- than a 500.
CREATE UNIQUE INDEX IF NOT EXISTS "Store_tvSerial_key" ON "Store"("tvSerial");
