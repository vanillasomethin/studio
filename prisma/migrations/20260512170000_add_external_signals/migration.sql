-- CreateEnum
CREATE TYPE "ExternalSignalSource" AS ENUM ('market_sentiment', 'competitor_activity', 'infra_cost_efficiency');

-- CreateTable
CREATE TABLE "ExternalSignal" (
    "id" TEXT NOT NULL,
    "source" "ExternalSignalSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "trendVelocity" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "freshness" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSignal_source_sourceId_key" ON "ExternalSignal"("source", "sourceId");

-- CreateIndex
CREATE INDEX "ExternalSignal_source_observedAt_idx" ON "ExternalSignal"("source", "observedAt");

-- CreateIndex
CREATE INDEX "ExternalSignal_expiresAt_idx" ON "ExternalSignal"("expiresAt");
