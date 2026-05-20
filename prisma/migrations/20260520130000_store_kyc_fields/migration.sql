-- Store KYC fields for Digio Aadhaar eKYC integration
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycStatus"       TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycReferenceId"  TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycDocId"        TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycVerifiedAt"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Store_kycStatus_idx" ON "Store"("kycStatus");
