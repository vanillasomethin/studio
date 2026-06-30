-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "monthlyCompensationPaise" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'standard';

