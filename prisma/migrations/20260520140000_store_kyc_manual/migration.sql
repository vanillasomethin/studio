-- Manual KYC (replaces unused Digio columns approach — free until market expansion)
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycPanUrl"         TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycAadhaarUrl"     TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycSelfieUrl"      TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycAadhaarLast4"   TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycSubmittedAt"    TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "kycRejectedReason" TEXT;
