-- Self-serve slot booking (request-only): a brand spends credits requesting a
-- store + time-window; admin approves and manually assigns the real SlotBooking.
-- See src/lib/slot-windows.ts / slot-requests-db.ts.
ALTER TABLE "Campaign" ADD COLUMN "slotPricingTier" TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE "SlotRequest" (
    "id"          TEXT NOT NULL,
    "campaignId"  TEXT NOT NULL,
    "storeId"     TEXT NOT NULL,
    "window"      TEXT NOT NULL,
    "creditsCost" INTEGER NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "note"        TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt"   TIMESTAMP(3),
    "decidedBy"   TEXT,

    CONSTRAINT "SlotRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlotRequest_campaignId_idx" ON "SlotRequest"("campaignId");
CREATE INDEX "SlotRequest_storeId_idx" ON "SlotRequest"("storeId");
CREATE INDEX "SlotRequest_status_idx" ON "SlotRequest"("status");

ALTER TABLE "SlotRequest" ADD CONSTRAINT "SlotRequest_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlotRequest" ADD CONSTRAINT "SlotRequest_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
