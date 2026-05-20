-- Add force-sync flag to Device (admin can bust player cache)
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "forceSyncAt" TIMESTAMP(3);

-- Overlays — on-screen layouts (tickers, banners, news feeds)
CREATE TABLE IF NOT EXISTS "Overlay" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "enabled"       BOOLEAN NOT NULL DEFAULT TRUE,
  "text"          TEXT,
  "feedUrl"       TEXT,
  "imageUrl"      TEXT,
  "feedItems"     JSONB,
  "feedFetchedAt" TIMESTAMP(3),
  "position"      TEXT NOT NULL DEFAULT 'BOTTOM',
  "bgColor"       TEXT,
  "fgColor"       TEXT,
  "speedPxSec"    INTEGER NOT NULL DEFAULT 60,
  "heightPct"     INTEGER NOT NULL DEFAULT 8,
  "deviceIds"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "groupName"     TEXT,
  "storeIds"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cityFilter"    TEXT,
  "startAt"       TIMESTAMP(3),
  "endAt"         TIMESTAMP(3),
  "dailyStart"    TEXT,
  "dailyEnd"      TEXT,
  "requireWifi"   BOOLEAN NOT NULL DEFAULT FALSE,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Overlay_enabled_idx"     ON "Overlay"("enabled");
CREATE INDEX IF NOT EXISTS "Overlay_cityFilter_idx"  ON "Overlay"("cityFilter");
CREATE INDEX IF NOT EXISTS "Overlay_groupName_idx"   ON "Overlay"("groupName");
