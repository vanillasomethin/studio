-- One Razorpay order may produce at most one campaign.
--
-- verify-payment looked the campaign up by orderId and created it when absent.
-- Two concurrent confirmations of the same payment could both read "absent" and
-- both create, yielding a duplicate PAID campaign. The application cannot close
-- that window on its own; only a constraint can.
--
-- SAFETY: this index fails to build if duplicate orderIds already exist, and
-- `prisma migrate deploy` runs on every build — a failure here blocks deploys.
-- Production was checked immediately before this migration was written
-- (2026-09-01): 0 campaigns, 0 with an orderId, 0 duplicate groups. The guard
-- below re-checks at apply time rather than trusting that snapshot, and raises
-- a message that says what to do instead of a bare constraint violation.
--
-- The column stays nullable. Postgres treats NULLs as distinct in a unique
-- index, so any number of campaigns without an order (trials, admin-created,
-- pay-later before checkout) remain valid.
DO $$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT "orderId"
    FROM "Campaign"
    WHERE "orderId" IS NOT NULL
    GROUP BY "orderId"
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique index: % Campaign.orderId value(s) are duplicated. These are double-created paid campaigns (BUG-17). Reconcile them before deploying — see scratchpad/check-dup-orderids.mjs for the affected rows.', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX "Campaign_orderId_key" ON "Campaign"("orderId");
