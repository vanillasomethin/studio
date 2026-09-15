-- Standing slot assignments: "brand X plays N times a day at store Y, from D,
-- until stopped" — one row, instead of the one-row-per-store-per-date-per-position
-- materialisation SlotBooking uses (and its silent expiry when the range runs out).
--
-- A plan is a TARGETED FILLER WITH PRIORITY: it only ever takes positions left over
-- after sold bookings, so `Availability = loopSlotCount - sold bookings` stays
-- exactly true and SLA / spans / add-ons / SlotRequest are untouched.
--
-- endDate is nullable on purpose — an open end is the whole point of the model.
-- Both FKs CASCADE: a plan is meaningless without its store or its campaign, and
-- unlike a creative it holds no history worth keeping once either is gone.
CREATE TABLE "SlotPlan" (
    "id"          TEXT NOT NULL,
    "storeId"     TEXT NOT NULL,
    "campaignId"  TEXT NOT NULL,
    "slotsPerDay" INTEGER NOT NULL DEFAULT 1,
    "startDate"   DATE NOT NULL,
    "endDate"     DATE,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotPlan_pkey" PRIMARY KEY ("id")
);

-- One standing assignment per brand per store: changing the rate must be an edit,
-- not a second row that silently doubles the brand's plays.
CREATE UNIQUE INDEX "SlotPlan_storeId_campaignId_key" ON "SlotPlan"("storeId", "campaignId");

-- The loop builder's read path: every active plan for one store.
CREATE INDEX "SlotPlan_storeId_active_idx" ON "SlotPlan"("storeId", "active");
CREATE INDEX "SlotPlan_campaignId_idx" ON "SlotPlan"("campaignId");

ALTER TABLE "SlotPlan" ADD CONSTRAINT "SlotPlan_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlotPlan" ADD CONSTRAINT "SlotPlan_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
