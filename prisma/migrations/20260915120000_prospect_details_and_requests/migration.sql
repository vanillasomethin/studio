-- Richer prospect fields (owner/phone/address/pincode), and a public "brand
-- wants this onboarded" lead separate from ProspectLocation's admin-only rows.

ALTER TABLE "ProspectLocation" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "ProspectLocation" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "ProspectLocation" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "ProspectLocation" ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE TABLE IF NOT EXISTS "ProspectRequest" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProspectRequest_prospectId_idx" ON "ProspectRequest"("prospectId");
CREATE INDEX IF NOT EXISTS "ProspectRequest_createdAt_idx" ON "ProspectRequest"("createdAt");

DO $$ BEGIN
    ALTER TABLE "ProspectRequest" ADD CONSTRAINT "ProspectRequest_prospectId_fkey"
        FOREIGN KEY ("prospectId") REFERENCES "ProspectLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
