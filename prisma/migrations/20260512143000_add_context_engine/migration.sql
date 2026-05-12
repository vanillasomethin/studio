-- Create context sync watermark table
CREATE TABLE "ContextSyncState" (
  "key" TEXT NOT NULL,
  "watermark" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContextSyncState_pkey" PRIMARY KEY ("key")
);

-- Create canonical context document table
CREATE TABLE "ContextDocument" (
  "id" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "actors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "serviceArea" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "rawRef" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContextDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContextDocument_sourceType_sourceId_key" ON "ContextDocument"("sourceType", "sourceId");
CREATE INDEX "ContextDocument_timestamp_idx" ON "ContextDocument"("timestamp");
CREATE INDEX "ContextDocument_serviceArea_idx" ON "ContextDocument"("serviceArea");
