-- Add liveAt to Store
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "liveAt" TIMESTAMP(3);

-- Create StorePayment table
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

ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "StorePayment_storeId_month_key" ON "StorePayment"("storeId", "month");
CREATE INDEX IF NOT EXISTS "StorePayment_storeId_idx" ON "StorePayment"("storeId");
CREATE INDEX IF NOT EXISTS "StorePayment_month_idx" ON "StorePayment"("month");
CREATE INDEX IF NOT EXISTS "StorePayment_status_idx" ON "StorePayment"("status");
