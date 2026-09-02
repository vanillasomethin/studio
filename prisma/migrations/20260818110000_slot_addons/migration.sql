-- Peak Boost / Sound Ad add-ons: flags on top of an existing slot booking, scoped
-- to (store, campaign, type). See src/lib/addons.ts / src/lib/addons-db.ts.
ALTER TABLE "Store" ADD COLUMN "soundAdMuted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SlotAddon" (
    "id"         TEXT NOT NULL,
    "storeId"    TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'active',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotAddon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlotAddon_storeId_type_status_idx" ON "SlotAddon"("storeId", "type", "status");
CREATE INDEX "SlotAddon_campaignId_idx" ON "SlotAddon"("campaignId");
CREATE UNIQUE INDEX "SlotAddon_storeId_campaignId_type_key" ON "SlotAddon"("storeId", "campaignId", "type");

ALTER TABLE "SlotAddon" ADD CONSTRAINT "SlotAddon_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlotAddon" ADD CONSTRAINT "SlotAddon_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
