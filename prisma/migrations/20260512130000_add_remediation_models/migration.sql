-- CreateEnum
CREATE TYPE "RemediationTicketStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RemediationActionType" AS ENUM ('CONFIG_CHANGE', 'ROLLBACK', 'PATCH_TARGET');

-- CreateEnum
CREATE TYPE "RemediationApplyMode" AS ENUM ('AUTO', 'REQUIRES_APPROVAL');

-- CreateTable
CREATE TABLE "RemediationTicket" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "RemediationTicketStatus" NOT NULL DEFAULT 'OPEN',
    "triggerType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "triggerWindowStart" TIMESTAMP(3),
    "triggerWindowEnd" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RemediationTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationProposal" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "actionType" "RemediationActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposedChange" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "blastRadius" TEXT NOT NULL,
    "blastRadiusScore" INTEGER NOT NULL DEFAULT 1,
    "applyMode" "RemediationApplyMode" NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalState" TEXT NOT NULL DEFAULT 'PENDING',
    "prHookState" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationTicket_deviceId_status_createdAt_idx" ON "RemediationTicket"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationTicket_status_createdAt_idx" ON "RemediationTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationProposal_ticketId_rank_idx" ON "RemediationProposal"("ticketId", "rank");

-- CreateIndex
CREATE INDEX "RemediationProposal_actionType_applyMode_idx" ON "RemediationProposal"("actionType", "applyMode");

-- AddForeignKey
ALTER TABLE "RemediationTicket" ADD CONSTRAINT "RemediationTicket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationProposal" ADD CONSTRAINT "RemediationProposal_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RemediationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
