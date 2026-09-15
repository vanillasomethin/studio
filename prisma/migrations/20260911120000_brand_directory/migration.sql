-- Brand becomes the advertiser directory: a login is optional.
--
-- Widening only — every existing row already has a userId and non-null contact
-- details, so this cannot fail on live data and needs no backfill. The unique
-- index on userId is kept: Postgres allows many NULLs in a unique index, so
-- login-less brands coexist with one-login-one-brand for those that have one.
--
-- Dropping NOT NULL does not rewrite the table, so this is a metadata-only change.

ALTER TABLE "Brand" ALTER COLUMN "userId"      DROP NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "contactName" DROP NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "email"       DROP NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "phone"       DROP NOT NULL;

-- The FK was created by the required relation and stays valid for NULLs
-- (a NULL FK is never checked), so it is deliberately left untouched.
