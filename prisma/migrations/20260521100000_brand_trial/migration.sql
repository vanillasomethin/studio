-- Brand trial offer tracking
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "trialOfferedAt" TIMESTAMP(3);
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "trialUsedAt" TIMESTAMP(3);
