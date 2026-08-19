-- Alerts & Notifications action state: assignment (team/person), close/reopen, and
-- comments, layered on top of the client-computed alerts (see AlertsTab.buildAlerts)
-- by their deterministic alertId. No admin user accounts exist, so assignee/author
-- are free text (same loose-actor convention as AuditLog.actorId).
CREATE TABLE "AlertAction" (
    "id"        TEXT NOT NULL,
    "alertId"   TEXT NOT NULL,
    "team"      TEXT,
    "assignee"  TEXT,
    "status"    TEXT NOT NULL DEFAULT 'open',
    "closedAt"  TIMESTAMP(3),
    "closedBy"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertAction_alertId_key" ON "AlertAction"("alertId");
CREATE INDEX "AlertAction_status_idx" ON "AlertAction"("status");
CREATE INDEX "AlertAction_team_idx" ON "AlertAction"("team");

CREATE TABLE "AlertComment" (
    "id"        TEXT NOT NULL,
    "alertId"   TEXT NOT NULL,
    "author"    TEXT,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertComment_alertId_idx" ON "AlertComment"("alertId");
CREATE INDEX "AlertComment_createdAt_idx" ON "AlertComment"("createdAt");
