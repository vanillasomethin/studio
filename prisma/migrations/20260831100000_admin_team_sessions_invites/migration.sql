-- Admin team management: tracked sessions + single-use invites.
--
-- Purely additive: two NEW tables and no change to any existing column, so this
-- cannot affect a running deploy. Nothing reads them until the console ships.
--
-- WHY AdminSession exists at all: the Auth.js "Session" table in this schema is
-- permanently empty. Auth.js v5 only supports session strategy 'jwt' alongside
-- the Credentials providers this app uses, so the adapter never writes session
-- rows. A JWT is stateless and stays valid until it expires regardless of the
-- database, which means that without this table there is no way to see who is
-- signed in and no way to sign anyone out. The id of a row here is embedded in
-- the JWT as `sid`, and the admin guard rejects a request whose row is missing
-- or revoked — that lookup is what turns a stateless token into a revocable one.
--
-- Idempotent (IF NOT EXISTS) to match house style: these run inside the Vercel
-- build, where a failed migration breaks the whole deploy.

CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  TIMESTAMP(3),
    "revokedBy"  TEXT,
    "ip"         TEXT,
    "userAgent"  TEXT,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- ON DELETE CASCADE: removing a person must not leave their live sessions
-- behind as orphans that the revocation lookup would still have to reason about.
DO $$ BEGIN
    ALTER TABLE "AdminSession"
      ADD CONSTRAINT "AdminSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AdminSession_userId_idx"     ON "AdminSession"("userId");
CREATE INDEX IF NOT EXISTS "AdminSession_lastSeenAt_idx" ON "AdminSession"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "AdminSession_revokedAt_idx"  ON "AdminSession"("revokedAt");

CREATE TABLE IF NOT EXISTS "AdminInvite" (
    "id"         TEXT         NOT NULL,
    "email"      TEXT         NOT NULL,
    "role"       "UserRole"   NOT NULL,
    -- SHA-256 of the invite token, never the token. The raw value lives only in
    -- the email, so a dump of this table yields no usable links.
    "tokenHash"  TEXT         NOT NULL,
    "invitedBy"  TEXT,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

-- UNIQUE on the hash: the accept path looks an invite up BY hash, so a duplicate
-- would make "which invite is this?" ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminInvite_email_idx"     ON "AdminInvite"("email");
CREATE INDEX IF NOT EXISTS "AdminInvite_expiresAt_idx" ON "AdminInvite"("expiresAt");
