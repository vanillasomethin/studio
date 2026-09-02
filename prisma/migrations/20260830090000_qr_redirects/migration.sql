-- Trackable QR redirects: /r/<slug> counts the scan, then 302s to targetUrl.

CREATE TABLE "QrDestination" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "label"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrDestination_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrDestination_slug_key" ON "QrDestination"("slug");

CREATE TABLE "QrScan" (
    "id"            TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "scannedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer"      TEXT,
    "userAgent"     TEXT,
    "ip"            TEXT,
    "country"       TEXT,
    "city"          TEXT,
    CONSTRAINT "QrScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QrScan_destinationId_scannedAt_idx" ON "QrScan"("destinationId", "scannedAt");
CREATE INDEX "QrScan_scannedAt_idx" ON "QrScan"("scannedAt");

ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_destinationId_fkey"
    FOREIGN KEY ("destinationId") REFERENCES "QrDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the default destination. ON CONFLICT so re-running (or a later reset that
-- replays migrations over an existing row) is harmless.
INSERT INTO "QrDestination" ("id", "slug", "targetUrl", "label", "createdAt")
VALUES ('qrdest_main', 'main', 'https://wearealive.in', 'Main', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
