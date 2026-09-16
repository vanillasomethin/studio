-- Add per-store electricity rate column
ALTER TABLE "Store" ADD COLUMN "electricityPaisePerKwh" INTEGER;
