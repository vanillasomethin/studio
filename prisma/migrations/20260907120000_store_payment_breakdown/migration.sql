-- Frozen payout breakdown on StorePayment.
--
-- Additive and all-nullable: existing rows keep only amountPaise and read back
-- as "no breakdown recorded", which the UI renders as a legacy flat payment.
-- No backfill — the sources needed to reconstruct historical months (PlugReading
-- past its 180-day prune, SlotBookings of deleted campaigns) are already gone,
-- and inventing them would be worse than admitting they are unknown.

ALTER TABLE "StorePayment" ADD COLUMN "basePaise" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "incentivePaise" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "electricityPaise" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "kwh" DOUBLE PRECISION;
ALTER TABLE "StorePayment" ADD COLUMN "kwhSource" TEXT;
ALTER TABLE "StorePayment" ADD COLUMN "paisePerKwh" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "brandsPlayed" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "filledSlotDays" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "avgFilledSlots" DOUBLE PRECISION;
ALTER TABLE "StorePayment" ADD COLUMN "liveDays" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "daysInMonth" INTEGER;
ALTER TABLE "StorePayment" ADD COLUMN "tierAtPayout" TEXT;
ALTER TABLE "StorePayment" ADD COLUMN "payoutMode" TEXT;
ALTER TABLE "StorePayment" ADD COLUMN "computedAt" TIMESTAMP(3);
