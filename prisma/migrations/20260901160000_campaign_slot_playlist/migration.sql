-- Campaign.slotPlaylistId — optional multi-creative rotation for slot mode.
-- A campaign may attach a Playlist instead of the single 10s slotContentId; its
-- direct media items rotate deterministically across the campaign's booked
-- positions and day by day (see lib/slots.ts buildSlotLoop). Nullable + SET NULL
-- on playlist delete: losing the playlist degrades the campaign back to its
-- single creative (or bonus/filler redistribution), never breaks a booking.
--
-- Idempotent (IF NOT EXISTS / guarded FK) to match the house style: these run
-- inside the Vercel build, where a failure breaks deploy.

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "slotPlaylistId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_slotPlaylistId_fkey"
    FOREIGN KEY ("slotPlaylistId") REFERENCES "Playlist"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
