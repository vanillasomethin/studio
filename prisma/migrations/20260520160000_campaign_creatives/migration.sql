-- Campaign creative URLs — brands can upload directly during onboarding
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "creativeUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
