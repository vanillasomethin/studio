-- CreateTable
CREATE TABLE "BrandEnquiry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "category" TEXT,
    "budgetBand" TEXT,
    "storeSlugs" TEXT[],
    "slotsPerStore" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "creativeStatus" TEXT,
    "notes" TEXT,
    "agreementVersion" TEXT NOT NULL,
    "agreementAcceptedAt" TIMESTAMP(3) NOT NULL,
    "estMonthlyPaise" INTEGER NOT NULL,
    "estTotalPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandEnquiry_reference_key" ON "BrandEnquiry"("reference");

-- CreateIndex
CREATE INDEX "BrandEnquiry_status_createdAt_idx" ON "BrandEnquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrandEnquiry_createdAt_idx" ON "BrandEnquiry"("createdAt");

-- CreateIndex
CREATE INDEX "BrandEnquiry_phone_idx" ON "BrandEnquiry"("phone");

