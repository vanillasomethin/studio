-- Shop category (kirana, supermarket, pharmacy, …) for store partners.
-- Nullable on purpose: the existing fleet predates the field, and the admin
-- panel treats NULL as "not categorised yet". Allowed slugs are enforced in
-- the API (src/lib/store-categories.ts), not by the database.
ALTER TABLE "Store" ADD COLUMN "category" TEXT;
