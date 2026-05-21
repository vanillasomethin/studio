-- Device telemetry fields reported by ALIVE Player (CPU temperature, storage, versions)
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "cpuTempC"         DOUBLE PRECISION;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "cpuTempUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "freeStorageMb"    INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "androidVersion"   TEXT;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "appVersion"       TEXT;
