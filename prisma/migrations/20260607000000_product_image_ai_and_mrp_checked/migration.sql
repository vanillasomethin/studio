-- AlterTable: track AI-generated images and MRP scrape freshness on Product
ALTER TABLE "Product" ADD COLUMN     "imageIsAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mrpCheckedAt" TIMESTAMP(3);
