-- The shopkeeper's own answer to "why did your screen go off?", asked via push
-- when an outage is escalated to them. Separate from `cause` (the server's
-- telemetry verdict) so the two can be compared once player uptime reporting
-- ships — today the classifier returns UNKNOWN fleet-wide, so this human answer
-- is the only cause signal available.
-- Both nullable, no backfill, no locks beyond a metadata change.
ALTER TABLE "DeviceAlert" ADD COLUMN "partnerReportedCause" TEXT;
ALTER TABLE "DeviceAlert" ADD COLUMN "partnerReportedAt" TIMESTAMP(3);
