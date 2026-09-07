-- Minimum Play Guarantee (SLA): one row per closed billing cycle (calendar month of a
-- campaign's flight) once shortfall has been checked against Proof-of-Play. See
-- src/lib/sla.ts / src/lib/sla-db.ts.
CREATE TABLE "PlayGuaranteeCycle" (
    "id"              TEXT NOT NULL,
    "campaignId"      TEXT NOT NULL,
    "cycleIndex"      INTEGER NOT NULL,
    "cycleStart"      DATE NOT NULL,
    "cycleEnd"        DATE NOT NULL,
    "promisedPlays"   INTEGER NOT NULL,
    "deliveredPlays"  INTEGER NOT NULL,
    "shortfallPlays"  INTEGER NOT NULL DEFAULT 0,
    "remedyType"      TEXT,
    "makegoodBalance" INTEGER NOT NULL DEFAULT 0,
    "creditAmount"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayGuaranteeCycle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayGuaranteeCycle_campaignId_idx" ON "PlayGuaranteeCycle"("campaignId");
CREATE INDEX "PlayGuaranteeCycle_remedyType_makegoodBalance_idx" ON "PlayGuaranteeCycle"("remedyType", "makegoodBalance");
CREATE UNIQUE INDEX "PlayGuaranteeCycle_campaignId_cycleIndex_key" ON "PlayGuaranteeCycle"("campaignId", "cycleIndex");

ALTER TABLE "PlayGuaranteeCycle" ADD CONSTRAINT "PlayGuaranteeCycle_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
