-- Named admin accounts, replacing the shared ADMIN_PASSWORD as the human-facing login.
CREATE TABLE "AdminUser" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "team"         TEXT NOT NULL,
    "passwordHash" TEXT,
    "inviteToken"  TEXT,
    "inviteSentAt" TIMESTAMP(3),
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE UNIQUE INDEX "AdminUser_inviteToken_key" ON "AdminUser"("inviteToken");
CREATE INDEX "AdminUser_active_idx" ON "AdminUser"("active");
