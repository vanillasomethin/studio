ALTER TABLE "Store"
  ADD COLUMN "onboardingStage" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN "payoutStatus" TEXT NOT NULL DEFAULT 'pending_setup',
  ADD COLUMN "payoutMethod" TEXT,
  ADD COLUMN "upiId" TEXT,
  ADD COLUMN "bankAccountName" TEXT,
  ADD COLUMN "bankAccountNo" TEXT,
  ADD COLUMN "bankIfsc" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "payoutLastPaidAt" TIMESTAMP(3),
  ADD COLUMN "payoutNotes" TEXT;
