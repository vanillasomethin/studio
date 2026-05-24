-- CreateEnum
CREATE TYPE "DeviceOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT', 'AUTO');

-- AlterTable: add orientation to Device
ALTER TABLE "Device" ADD COLUMN "orientation" "DeviceOrientation" NOT NULL DEFAULT 'LANDSCAPE';

-- CreateTable: Composition
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "zones" JSONB NOT NULL,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Composition_isPreset_idx" ON "Composition"("isPreset");
