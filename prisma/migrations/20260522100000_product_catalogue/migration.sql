-- Product catalogue table + productId column on StoreOffer

CREATE TABLE IF NOT EXISTS "Product" (
  "id"          TEXT NOT NULL,   -- CAT-BRAND-SEQ e.g. GRO-KC-001
  "groupId"     TEXT NOT NULL,   -- CAT-BRAND     e.g. GRO-KC
  "productName" TEXT NOT NULL,
  "brand"       TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "sizeVariant" TEXT NOT NULL,
  "unitType"    TEXT NOT NULL,
  "mrp"         INTEGER,
  "imageUrl"    TEXT,
  "barcodeEan"  TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Product_groupId_idx"   ON "Product"("groupId");
CREATE INDEX IF NOT EXISTS "Product_category_idx"  ON "Product"("category");
CREATE INDEX IF NOT EXISTS "Product_brand_idx"     ON "Product"("brand");
CREATE INDEX IF NOT EXISTS "Product_isActive_idx"  ON "Product"("isActive");

-- Link StoreOffer to Product (nullable — freeform entries still allowed)
ALTER TABLE "StoreOffer"
  ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "StoreOffer_productId_idx" ON "StoreOffer"("productId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreOffer_productId_fkey') THEN
    ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
