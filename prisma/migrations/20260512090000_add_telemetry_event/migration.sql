-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "errorClass" TEXT,
    "message" TEXT NOT NULL,
    "stackHash" TEXT,
    "correlationId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "requestMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelemetryEvent_route_createdAt_idx" ON "TelemetryEvent"("route", "createdAt");
CREATE INDEX "TelemetryEvent_correlationId_idx" ON "TelemetryEvent"("correlationId");
CREATE INDEX "TelemetryEvent_deviceId_idx" ON "TelemetryEvent"("deviceId");

-- AddForeignKey
ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
