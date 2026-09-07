-- Locations ALIVE is considering, kept out of every public surface.
--
-- A Store with a pin appears on the marketing map immediately, which is correct
-- for a partner and wrong for a prospect — scouting notes must not advertise
-- shops that have agreed to nothing. Hence a separate table that no public route
-- reads.
CREATE TABLE "ProspectLocation" (
    "id"        TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "lat"       DOUBLE PRECISION NOT NULL,
    "lng"       DOUBLE PRECISION NOT NULL,
    "locality"  TEXT,
    "city"      TEXT,
    "notes"     TEXT,
    "status"    TEXT NOT NULL DEFAULT 'scouting',
    "storeId"   TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectLocation_status_idx"    ON "ProspectLocation"("status");
CREATE INDEX "ProspectLocation_createdAt_idx" ON "ProspectLocation"("createdAt");
