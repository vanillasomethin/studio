-- Tuya smart-plug power monitoring (Aziot / Smart Life): per-store plug link
-- with latest-poll snapshot, and a power/energy readings time series. Replaces
-- the removed eWeLink integration (20260901120000) with two deliberate changes:
-- the plug hangs off Store, not Device (Device rows are deleted on re-pair, and
-- the plug is site hardware), and energy is integrated per interval so totals
-- are a plain SUM.
--
-- Idempotent throughout (CREATE ... IF NOT EXISTS, guarded FK) to match the
-- house style: these run inside the Vercel build, where a failure breaks deploy.

CREATE TABLE IF NOT EXISTS "SmartPlug" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tuyaDeviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productName" TEXT,
    "category" TEXT,
    "online" BOOLEAN,
    "switchOn" BOOLEAN,
    "socketsOn" INTEGER,
    "socketCount" INTEGER,
    "powerW" DOUBLE PRECISION,
    "voltageV" DOUBLE PRECISION,
    "currentA" DOUBLE PRECISION,
    "scales" JSONB,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmartPlug_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlugReading" (
    "id" TEXT NOT NULL,
    "plugId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "online" BOOLEAN NOT NULL,
    "switchOn" BOOLEAN NOT NULL,
    "powerW" DOUBLE PRECISION,
    "energyWh" DOUBLE PRECISION,
    CONSTRAINT "PlugReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SmartPlug_storeId_key" ON "SmartPlug"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "SmartPlug_tuyaDeviceId_key" ON "SmartPlug"("tuyaDeviceId");
CREATE INDEX IF NOT EXISTS "PlugReading_plugId_at_idx" ON "PlugReading"("plugId", "at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmartPlug_storeId_fkey') THEN
    ALTER TABLE "SmartPlug" ADD CONSTRAINT "SmartPlug_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlugReading_plugId_fkey') THEN
    ALTER TABLE "PlugReading" ADD CONSTRAINT "PlugReading_plugId_fkey"
      FOREIGN KEY ("plugId") REFERENCES "SmartPlug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
