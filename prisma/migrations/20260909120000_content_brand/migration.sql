-- Creative ownership: which brand a piece of Content belongs to.
--
-- Nullable and deliberately not backfilled. ALIVE's own house media — fillers,
-- product shots, store-offer and flyer templates — belongs to no brand, and NULL
-- is the honest way to record that rather than inventing an owner for it.
--
-- ON DELETE SET NULL rather than CASCADE: a removed brand's creative may still be
-- booked into a live loop, and taking the file with the brand would blank a screen
-- mid-flight.
ALTER TABLE "Content" ADD COLUMN "brandId" TEXT;

CREATE INDEX "Content_brandId_idx" ON "Content"("brandId");

ALTER TABLE "Content" ADD CONSTRAINT "Content_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
