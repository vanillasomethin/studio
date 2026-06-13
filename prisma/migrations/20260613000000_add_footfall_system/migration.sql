-- WiFi CSI Footfall & Screen Presence system
-- New tables: FootfallEvent, FootfallHourly, ScreenPresenceEvent, StoreSensorHealth
-- Plus Store.excludedZoneId for staff-zone exclusion

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "excludedZoneId" TEXT;

-- ─── FootfallEvent ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FootfallEvent" (
    "id"              TEXT NOT NULL,
    "storeId"         TEXT NOT NULL,
    "timestamp"       TIMESTAMP(3) NOT NULL,
    "amplitude"       DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "bleCorroborated" BOOLEAN NOT NULL DEFAULT false,
    "isCounted"       BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "zoneId"          TEXT,
    "detectionMethod" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FootfallEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FootfallEvent_storeId_timestamp_idx" ON "FootfallEvent"("storeId", "timestamp");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FootfallEvent_storeId_fkey'
  ) THEN
    ALTER TABLE "FootfallEvent" ADD CONSTRAINT "FootfallEvent_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── FootfallHourly ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FootfallHourly" (
    "id"               TEXT NOT NULL,
    "storeId"          TEXT NOT NULL,
    "hourBucket"       TIMESTAMP(3) NOT NULL,
    "customerCount"    INTEGER NOT NULL DEFAULT 0,
    "unconfirmedCount" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence"    DOUBLE PRECISION,
    "excludedCount"    INTEGER NOT NULL DEFAULT 0,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootfallHourly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FootfallHourly_storeId_hourBucket_key" ON "FootfallHourly"("storeId", "hourBucket");
CREATE INDEX IF NOT EXISTS "FootfallHourly_storeId_idx" ON "FootfallHourly"("storeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FootfallHourly_storeId_fkey'
  ) THEN
    ALTER TABLE "FootfallHourly" ADD CONSTRAINT "FootfallHourly_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── ScreenPresenceEvent ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ScreenPresenceEvent" (
    "id"               TEXT NOT NULL,
    "storeId"          TEXT NOT NULL,
    "campaignId"       TEXT,
    "timestamp"        TIMESTAMP(3) NOT NULL,
    "presenceDetected" BOOLEAN NOT NULL DEFAULT false,
    "confidenceScore"  DOUBLE PRECISION,
    "interactionType"  TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenPresenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScreenPresenceEvent_storeId_timestamp_idx" ON "ScreenPresenceEvent"("storeId", "timestamp");
CREATE INDEX IF NOT EXISTS "ScreenPresenceEvent_campaignId_idx" ON "ScreenPresenceEvent"("campaignId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScreenPresenceEvent_storeId_fkey'
  ) THEN
    ALTER TABLE "ScreenPresenceEvent" ADD CONSTRAINT "ScreenPresenceEvent_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScreenPresenceEvent_campaignId_fkey'
  ) THEN
    ALTER TABLE "ScreenPresenceEvent" ADD CONSTRAINT "ScreenPresenceEvent_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── StoreSensorHealth ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StoreSensorHealth" (
    "id"                 TEXT NOT NULL,
    "storeId"            TEXT NOT NULL,
    "ruviewLastSeen"     TIMESTAMP(3),
    "ruviewUptime"       DOUBLE PRECISION,
    "espresenseLastSeen" TIMESTAMP(3),
    "espresenseUptime"   DOUBLE PRECISION,
    "calibrationStatus"  TEXT,
    "firmwareVersion"    TEXT,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSensorHealth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreSensorHealth_storeId_key" ON "StoreSensorHealth"("storeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreSensorHealth_storeId_fkey'
  ) THEN
    ALTER TABLE "StoreSensorHealth" ADD CONSTRAINT "StoreSensorHealth_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
