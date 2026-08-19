-- Slot pricing tiers (Standard/Growth/Flagship): admin-assigned per store, drives
-- both brand billing and store payout for slot-mode stores. See src/lib/slot-pricing.ts.
ALTER TABLE "Store" ADD COLUMN "slotPricingTier" TEXT NOT NULL DEFAULT 'standard';
