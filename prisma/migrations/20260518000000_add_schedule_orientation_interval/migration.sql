-- Add orientation and intervalMins to Schedule
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "orientation" TEXT NOT NULL DEFAULT 'landscape';
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "intervalMins" INTEGER;
