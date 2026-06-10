CREATE TABLE IF NOT EXISTS "HourlyPop" (
  "id"          TEXT NOT NULL,
  "deviceId"    TEXT NOT NULL,
  "hour"        TIMESTAMP(3) NOT NULL,
  "playCount"   INTEGER NOT NULL DEFAULT 0,
  "totalMs"     INTEGER NOT NULL DEFAULT 0,
  "campaignIds" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HourlyPop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HourlyPop_deviceId_hour_key" ON "HourlyPop"("deviceId", "hour");
CREATE INDEX IF NOT EXISTS "HourlyPop_deviceId_idx" ON "HourlyPop"("deviceId");
CREATE INDEX IF NOT EXISTS "HourlyPop_hour_idx" ON "HourlyPop"("hour");
