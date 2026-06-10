-- Add tags and folder to Content for library organisation
ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "tags"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "folder" TEXT;

CREATE INDEX IF NOT EXISTS "Content_folder_idx" ON "Content"("folder");
