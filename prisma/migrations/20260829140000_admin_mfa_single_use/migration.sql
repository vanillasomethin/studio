-- Make admin TOTP codes single-use.
--
-- Extends 20260829130000_admin_mfa. Verification alone only proves a code is
-- currently valid, and "currently" spans ~90 seconds: the ±1 step drift
-- tolerance means three consecutive codes verify at any instant. Anyone who
-- observes a code — shoulder-surfing, a phishing proxy, malware reading the
-- authenticator screen — can therefore replay it well within that window.
--
-- Storing the highest step already spent closes that: a step is accepted only if
-- it is strictly greater than the last one recorded, so every code can be
-- redeemed exactly once. The login path claims the step with a conditional
-- UPDATE (WHERE mfaLastStep IS NULL OR mfaLastStep < $step) rather than a
-- read-then-write, so two concurrent sign-ins racing on the same code cannot
-- both succeed — the second matches zero rows and is refused.
--
-- NULLABLE, and purely additive: an account that has never completed a TOTP
-- login has no last step, and NULL is treated as "nothing spent yet". Existing
-- rows are unaffected, so this cannot break sign-in for anyone.
--
-- Idempotent to match house style — these run inside the Vercel build, where a
-- failed migration breaks the deploy.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaLastStep" INTEGER;
