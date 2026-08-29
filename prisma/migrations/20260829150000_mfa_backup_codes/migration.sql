-- Backup codes for admin 2FA.
--
-- Extends 20260829130000_admin_mfa. Enrolling an authenticator with no recovery
-- path means a lost or wiped phone locks the operator out of the console until
-- someone edits this table by hand — so the practical effect was that 2FA was
-- unsafe to actually enable. Ten single-use codes make enrolment reversible.
--
-- mfaBackupCodes holds BCRYPT HASHES, never plaintext: each code is a complete
-- second factor on its own, so a leaked database must not yield working ones.
-- A consumed code is deleted from the array rather than flagged, so "spent" and
-- "never issued" are indistinguishable and there is nothing left to replay.
--
-- Additive and non-destructive: the array defaults to empty, so every existing
-- account simply has no codes until it generates a set. No backfill.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "mfaBackupCodesAt" TIMESTAMP(3);
