-- Record which campaign agreement a brand accepted, and when.
-- Additive only — no existing row or column is touched.
--
-- Nullable, unlike BrandEnquiry's equivalents: campaigns booked before this
-- migration genuinely carry no evidence of acceptance, and backfilling a
-- version would invent one. NULL here means "not captured", which is the truth.

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "agreementAcceptedAt" TIMESTAMP(3);
