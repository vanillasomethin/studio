-- Add pairing code columns to Device
-- pairingCode: 6-char code shown on TV screen; cleared (set null) after admin confirms
-- pairedAt: set by admin after entering the code; null means device not yet in fleet

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pairingCode" TEXT;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pairedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Device_pairingCode_key'
  ) THEN
    ALTER TABLE "Device" ADD CONSTRAINT "Device_pairingCode_key" UNIQUE ("pairingCode");
  END IF;
END $$;

-- Grandfather all existing devices as already paired (they registered before this flow)
UPDATE "Device" SET "pairedAt" = "claimedAt" WHERE "pairedAt" IS NULL;
