-- Proof-of-play archive: singleton config + per-period export history.
-- Additive only — no existing table is touched.

-- CreateEnum
CREATE TYPE "PopExportFrequency" AS ENUM ('MONTHLY', 'BIMONTHLY');

-- CreateEnum
CREATE TYPE "PopExportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PopExportConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "PopExportFrequency" NOT NULL DEFAULT 'MONTHLY',
    "deleteAfterExport" BOOLEAN NOT NULL DEFAULT false,
    "exportedThrough" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopExportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopExport" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PopExportStatus" NOT NULL DEFAULT 'RUNNING',
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "adCount" INTEGER NOT NULL DEFAULT 0,
    "screenCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "playsKey" TEXT,
    "byAdKey" TEXT,
    "byScreenKey" TEXT,
    "deletedRows" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PopExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PopExport_periodStart_idx" ON "PopExport"("periodStart");

-- CreateIndex
CREATE INDEX "PopExport_status_idx" ON "PopExport"("status");
