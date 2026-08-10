CREATE TYPE "RenditionTier" AS ENUM ('HEVC', 'H264_MAIN', 'H264_BASELINE');

ALTER TABLE "Device" ADD COLUMN "renditionTier" "RenditionTier" NOT NULL DEFAULT 'HEVC';
ALTER TABLE "Device" ADD COLUMN "lastTestDowngradeAt" TIMESTAMP(3);

ALTER TABLE "Content" ADD COLUMN "baselineObjectKey" TEXT;
ALTER TABLE "Content" ADD COLUMN "baselineMd5" TEXT;
ALTER TABLE "Content" ADD COLUMN "baselineSizeBytes" BIGINT;
CREATE UNIQUE INDEX "Content_baselineObjectKey_key" ON "Content"("baselineObjectKey");
