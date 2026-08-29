-- Admin TOTP second factor.
--
-- Adds the two columns that back 2FA for ADMIN/OPS accounts:
--
--   mfaSecret    base32 TOTP seed, written at enrolment
--   mfaEnabledAt stamped only when a first valid code is submitted
--
-- The split matters. The seed is stored the moment enrolment starts, but it is
-- not TRUSTED until mfaEnabledAt is set, so an operator who scans the QR and
-- then closes the tab is never left with an account that believes it is
-- protected while no authenticator can actually produce a code for it. Every
-- check therefore keys off mfaEnabledAt, never off the presence of a secret.
--
-- Both NULLABLE and purely additive: every existing user is simply unenrolled.
-- No backfill, no default, no rewrite of existing rows — this cannot lock anyone
-- out of an account that works today.
--
-- Ordering: this must land BEFORE 20260829140000_admin_mfa_single_use, which
-- adds mfaLastStep on top of these. The timestamps enforce that.
--
-- Idempotent to match house style — these run inside the Vercel build, where a
-- failed migration breaks the deploy.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaEnabledAt" TIMESTAMP(3);
