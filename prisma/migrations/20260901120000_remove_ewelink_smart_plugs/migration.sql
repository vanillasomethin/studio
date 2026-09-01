-- Remove the eWeLink smart-plug integration: drop the linked-account singleton,
-- the per-device plug link, and the power/energy readings time series. This
-- reverses 20260824100000_ewelink_power now that the feature has been deleted.
--
-- Idempotent (DROP ... IF EXISTS) to match the house style — these run inside the
-- Vercel build, where a failure breaks deploy. FK-safe order: PlugReading →
-- SmartPlug → EwelinkAccount. Each table's own foreign keys and indexes are
-- dropped with it.

DROP TABLE IF EXISTS "PlugReading";
DROP TABLE IF EXISTS "SmartPlug";
DROP TABLE IF EXISTS "EwelinkAccount";
