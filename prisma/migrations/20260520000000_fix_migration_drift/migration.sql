-- Fix migration drift: re-apply all post-init migrations with IF NOT EXISTS guards.
-- Safe to run even if some or all of these already exist.

-- ── Store payout tracking columns ────────────────────────────────────────────
ALTER TABLE "Store"
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

-- ── Bill / Customer tables ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Customer" (
    "id"        TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Bill" (
    "id"          TEXT NOT NULL,
    "billRef"     TEXT NOT NULL,
    "storeId"     TEXT,
    "storeName"   TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "payMethod"   TEXT NOT NULL DEFAULT 'cash',
    "status"      TEXT NOT NULL DEFAULT 'open',
    "customerId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillItem" (
    "id"     TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "name"   TEXT NOT NULL,
    "qty"    INTEGER NOT NULL,
    "unit"   TEXT NOT NULL DEFAULT 'pcs',
    "price"  INTEGER NOT NULL,
    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_phone_key"  ON "Customer"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_token_key"  ON "Customer"("token");
CREATE INDEX        IF NOT EXISTS "Customer_phone_idx"  ON "Customer"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Bill_billRef_key"    ON "Bill"("billRef");
CREATE INDEX        IF NOT EXISTS "Bill_customerId_idx" ON "Bill"("customerId");
CREATE INDEX        IF NOT EXISTS "Bill_storeId_idx"    ON "Bill"("storeId");
CREATE INDEX        IF NOT EXISTS "Bill_billRef_idx"    ON "Bill"("billRef");
CREATE INDEX        IF NOT EXISTS "Bill_createdAt_idx"  ON "Bill"("createdAt");
CREATE INDEX        IF NOT EXISTS "BillItem_billId_idx" ON "BillItem"("billId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bill_storeId_fkey') THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bill_customerId_fkey') THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillItem_billId_fkey') THEN
    ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey"
      FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── TelemetryEvent table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TelemetryEvent" (
    "id"            TEXT NOT NULL,
    "route"         TEXT NOT NULL,
    "level"         TEXT NOT NULL DEFAULT 'error',
    "errorClass"    TEXT,
    "message"       TEXT NOT NULL,
    "stackHash"     TEXT,
    "correlationId" TEXT NOT NULL,
    "actorType"     TEXT NOT NULL,
    "requestMeta"   JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId"      TEXT,
    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TelemetryEvent_route_createdAt_idx"  ON "TelemetryEvent"("route", "createdAt");
CREATE INDEX IF NOT EXISTS "TelemetryEvent_correlationId_idx"    ON "TelemetryEvent"("correlationId");
CREATE INDEX IF NOT EXISTS "TelemetryEvent_deviceId_idx"         ON "TelemetryEvent"("deviceId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelemetryEvent_deviceId_fkey') THEN
    ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Remediation enums + tables ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "RemediationTicketStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RemediationActionType" AS ENUM ('CONFIG_CHANGE', 'ROLLBACK', 'PATCH_TARGET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RemediationApplyMode" AS ENUM ('AUTO', 'REQUIRES_APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RemediationTicket" (
    "id"                 TEXT NOT NULL,
    "deviceId"           TEXT NOT NULL,
    "status"             "RemediationTicketStatus" NOT NULL DEFAULT 'OPEN',
    "triggerType"        TEXT NOT NULL,
    "severity"           TEXT NOT NULL DEFAULT 'medium',
    "triggerWindowStart" TIMESTAMP(3),
    "triggerWindowEnd"   TIMESTAMP(3),
    "snapshot"           JSONB NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"         TIMESTAMP(3),
    CONSTRAINT "RemediationTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RemediationProposal" (
    "id"               TEXT NOT NULL,
    "ticketId"         TEXT NOT NULL,
    "rank"             INTEGER NOT NULL,
    "actionType"       "RemediationActionType" NOT NULL,
    "title"            TEXT NOT NULL,
    "rationale"        TEXT NOT NULL,
    "proposedChange"   JSONB NOT NULL,
    "confidence"       DOUBLE PRECISION NOT NULL,
    "blastRadius"      TEXT NOT NULL,
    "blastRadiusScore" INTEGER NOT NULL DEFAULT 1,
    "applyMode"        "RemediationApplyMode" NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalState"    TEXT NOT NULL DEFAULT 'PENDING',
    "prHookState"      TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemediationProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RemediationTicket_deviceId_status_createdAt_idx" ON "RemediationTicket"("deviceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "RemediationTicket_status_createdAt_idx"          ON "RemediationTicket"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RemediationProposal_ticketId_rank_idx"           ON "RemediationProposal"("ticketId", "rank");
CREATE INDEX IF NOT EXISTS "RemediationProposal_actionType_applyMode_idx"    ON "RemediationProposal"("actionType", "applyMode");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RemediationTicket_deviceId_fkey') THEN
    ALTER TABLE "RemediationTicket" ADD CONSTRAINT "RemediationTicket_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RemediationProposal_ticketId_fkey') THEN
    ALTER TABLE "RemediationProposal" ADD CONSTRAINT "RemediationProposal_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "RemediationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Context engine tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ContextSyncState" (
    "key"       TEXT NOT NULL,
    "watermark" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContextSyncState_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "ContextDocument" (
    "id"          TEXT NOT NULL,
    "sourceType"  TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL,
    "actors"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceArea" TEXT NOT NULL,
    "summary"     TEXT NOT NULL,
    "rawRef"      TEXT NOT NULL,
    "embedding"   JSONB NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContextDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContextDocument_sourceType_sourceId_key" ON "ContextDocument"("sourceType", "sourceId");
CREATE INDEX        IF NOT EXISTS "ContextDocument_timestamp_idx"           ON "ContextDocument"("timestamp");
CREATE INDEX        IF NOT EXISTS "ContextDocument_serviceArea_idx"         ON "ContextDocument"("serviceArea");

-- ── External signals ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ExternalSignalSource" AS ENUM ('market_sentiment', 'competitor_activity', 'infra_cost_efficiency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ExternalSignal" (
    "id"                 TEXT NOT NULL,
    "source"             "ExternalSignalSource" NOT NULL,
    "sourceId"           TEXT NOT NULL,
    "observedAt"         TIMESTAMP(3) NOT NULL,
    "expiresAt"          TIMESTAMP(3) NOT NULL,
    "category"           TEXT NOT NULL,
    "summary"            TEXT NOT NULL,
    "details"            JSONB NOT NULL,
    "score"              DOUBLE PRECISION NOT NULL,
    "trendVelocity"      DOUBLE PRECISION NOT NULL,
    "confidence"         DOUBLE PRECISION NOT NULL,
    "freshness"          DOUBLE PRECISION NOT NULL,
    "severity"           TEXT NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalSignal_source_sourceId_key"   ON "ExternalSignal"("source", "sourceId");
CREATE INDEX        IF NOT EXISTS "ExternalSignal_source_observedAt_idx" ON "ExternalSignal"("source", "observedAt");
CREATE INDEX        IF NOT EXISTS "ExternalSignal_expiresAt_idx"         ON "ExternalSignal"("expiresAt");

-- ── Store offers ──────────────────────────────────────────────────────────────
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
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreOffer_storeId_idx"    ON "StoreOffer"("storeId");
CREATE INDEX IF NOT EXISTS "StoreOffer_active_idx"     ON "StoreOffer"("active");
CREATE INDEX IF NOT EXISTS "StoreOffer_validUntil_idx" ON "StoreOffer"("validUntil");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreOffer_storeId_fkey') THEN
    ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
