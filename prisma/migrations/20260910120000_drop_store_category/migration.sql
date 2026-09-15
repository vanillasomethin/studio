-- Drop the free-standing shop category from Store. A store's only
-- classification is its slot pricing tier (Store.slotPricingTier —
-- standard | growth | flagship), so the twelve-slug kirana/bakery/pharmacy
-- list was a second, unused way to categorise the same thing. This reverses
-- 20260907180000_store_category.
--
-- Idempotent (IF EXISTS) to match the house style — these run inside the
-- Vercel build, where a failure breaks the deploy.

ALTER TABLE "Store" DROP COLUMN IF EXISTS "category";
