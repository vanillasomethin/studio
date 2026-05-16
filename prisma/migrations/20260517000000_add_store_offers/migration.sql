-- CreateTable
CREATE TABLE "StoreOffer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "weight" TEXT,
    "mrp" INTEGER NOT NULL,
    "offerPrice" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreOffer_storeId_idx" ON "StoreOffer"("storeId");
CREATE INDEX "StoreOffer_active_idx" ON "StoreOffer"("active");
CREATE INDEX "StoreOffer_validUntil_idx" ON "StoreOffer"("validUntil");

-- AddForeignKey
ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
