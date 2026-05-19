-- Ensure every column added after the init migration exists.
-- Safe to run on any DB state — all statements use IF NOT EXISTS / DO guards.

-- ── Store ─────────────────────────────────────────────────────────────────────
ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "liveAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingStage"  TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "payoutStatus"     TEXT NOT NULL DEFAULT 'pending_setup',
  ADD COLUMN IF NOT EXISTS "payoutMethod"     TEXT,
  ADD COLUMN IF NOT EXISTS "upiId"            TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountName"  TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNo"    TEXT,
  ADD COLUMN IF NOT EXISTS "bankIfsc"         TEXT,
  ADD COLUMN IF NOT EXISTS "bankName"         TEXT,
  ADD COLUMN IF NOT EXISTS "payoutLastPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payoutNotes"      TEXT;

-- ── PlayEvent ─────────────────────────────────────────────────────────────────
ALTER TABLE "PlayEvent"
  ADD COLUMN IF NOT EXISTS "impressions" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "costPaise"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prevHash"    TEXT,
  ADD COLUMN IF NOT EXISTS "rowHash"     TEXT;

-- ── Content ───────────────────────────────────────────────────────────────────
ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "tags"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "folder" TEXT;

CREATE INDEX IF NOT EXISTS "Content_folder_idx" ON "Content"("folder");

-- ── StorePayment ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StorePayment" (
  "id"          TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "month"       TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL DEFAULT 50000,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "paidAt"      TIMESTAMP(3),
  "paidBy"      TEXT,
  "payRef"      TEXT,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorePayment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StorePayment_storeId_fkey') THEN
    ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StorePayment_storeId_month_key" ON "StorePayment"("storeId", "month");
CREATE INDEX        IF NOT EXISTS "StorePayment_storeId_idx"       ON "StorePayment"("storeId");
CREATE INDEX        IF NOT EXISTS "StorePayment_month_idx"         ON "StorePayment"("month");
CREATE INDEX        IF NOT EXISTS "StorePayment_status_idx"        ON "StorePayment"("status");

-- ── StoreOffer ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StoreOffer" (
  "id"          TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "weight"      TEXT,
  "mrp"         INTEGER NOT NULL,
  "offerPrice"  INTEGER NOT NULL,
  "validUntil"  TIMESTAMP(3),
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreOffer_storeId_fkey') THEN
    ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "StoreOffer_storeId_idx"    ON "StoreOffer"("storeId");
CREATE INDEX IF NOT EXISTS "StoreOffer_active_idx"     ON "StoreOffer"("active");
CREATE INDEX IF NOT EXISTS "StoreOffer_validUntil_idx" ON "StoreOffer"("validUntil");

-- ── Schedule orientation / interval ──────────────────────────────────────────
ALTER TABLE "Schedule"
  ADD COLUMN IF NOT EXISTS "orientation"  TEXT NOT NULL DEFAULT 'landscape',
  ADD COLUMN IF NOT EXISTS "intervalMins" INTEGER;

-- ── Device nowPlaying (monitoring thumbnails) ─────────────────────────────────
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "nowPlayingId"    TEXT,
  ADD COLUMN IF NOT EXISTS "nowPlayingSince" TIMESTAMP(3);
