-- Schedule store/city targeting fields
ALTER TABLE "Schedule"
  ADD COLUMN IF NOT EXISTS "storeIds"   TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cityFilter" TEXT;

-- Device store-link timestamp
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "linkedAt" TIMESTAMP(3);

-- Indexes
CREATE INDEX IF NOT EXISTS "Schedule_cityFilter_idx" ON "Schedule"("cityFilter");
