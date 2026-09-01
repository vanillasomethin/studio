-- Electricity estimation: per-store screen wattage + the survey photos that justify it
-- (null wattage = fleet default), plus the fleet default and tariff.
-- Estimates only — see src/lib/power.ts.
ALTER TABLE "Store" ADD COLUMN "screenWatts" INTEGER;
ALTER TABLE "Store" ADD COLUMN "screenModel" TEXT;
ALTER TABLE "Store" ADD COLUMN "screenPlatePhotoUrl" TEXT;
ALTER TABLE "Store" ADD COLUMN "screenRatingPhotoUrl" TEXT;
ALTER TABLE "Store" ADD COLUMN "screenSurveyedAt" TIMESTAMP(3);
ALTER TABLE "PlayerConfig" ADD COLUMN "defaultScreenWatts" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "PlayerConfig" ADD COLUMN "electricityPaisePerKwh" INTEGER NOT NULL DEFAULT 800;
