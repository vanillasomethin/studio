-- Multi-slot placements: rows booked together for one >10s ad share a spanId.
-- Additive nullable column + index — safe on live data; all existing rows stay
-- single-slot (spanId NULL).
ALTER TABLE "SlotBooking" ADD COLUMN "spanId" TEXT;

CREATE INDEX "SlotBooking_spanId_idx" ON "SlotBooking"("spanId");
