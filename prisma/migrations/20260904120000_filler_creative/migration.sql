-- House filler stops being a Campaign.
--
-- Filler was modelled as a Campaign, so ALIVE's own content appeared in the
-- campaigns list, the slot-booking picker and revenue reports, and every one of
-- those had to remember to filter it out. It gets its own table instead.
--
-- The data moves with it. Each Campaign currently referenced as a filler becomes
-- a FillerCreative row REUSING THE SAME ID, which keeps existing PlayEvent rows
-- (whose tag carries that id) joinable and makes the store/config repoint a
-- straight copy. Then the old columns go, so there is one place a filler can be
-- configured rather than two that can disagree.

CREATE TABLE "FillerCreative" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "contentId"  TEXT,
    "playlistId" TEXT,
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FillerCreative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FillerCreative_active_idx" ON "FillerCreative"("active");

ALTER TABLE "FillerCreative" ADD CONSTRAINT "FillerCreative_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FillerCreative" ADD CONSTRAINT "FillerCreative_playlistId_fkey"
    FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Store"        ADD COLUMN "fillerCreativeId" TEXT;
ALTER TABLE "PlayerConfig" ADD COLUMN "fillerCreativeId" TEXT;

-- Carry every campaign that is currently acting as a filler across, id and all.
INSERT INTO "FillerCreative" ("id", "name", "contentId", "playlistId", "active", "createdAt", "updatedAt")
SELECT c."id",
       COALESCE(NULLIF(c."name", ''), 'House filler'),
       c."slotContentId",
       c."slotPlaylistId",
       true,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."id" IN (
        SELECT "fillerCampaignId" FROM "Store"        WHERE "fillerCampaignId" IS NOT NULL
  UNION SELECT "fillerCampaignId" FROM "PlayerConfig" WHERE "fillerCampaignId" IS NOT NULL
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Store" s
   SET "fillerCreativeId" = s."fillerCampaignId"
 WHERE s."fillerCampaignId" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "FillerCreative" f WHERE f."id" = s."fillerCampaignId");

UPDATE "PlayerConfig" p
   SET "fillerCreativeId" = p."fillerCampaignId"
 WHERE p."fillerCampaignId" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "FillerCreative" f WHERE f."id" = p."fillerCampaignId");

ALTER TABLE "Store" ADD CONSTRAINT "Store_fillerCreativeId_fkey"
    FOREIGN KEY ("fillerCreativeId") REFERENCES "FillerCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The old Campaign rows are deliberately NOT deleted. PlayEvent cascades from
-- Campaign, so removing them would take every filler play ever recorded with
-- them — proof-of-play history destroyed to tidy a list. They stay, and the
-- campaigns API excludes any id that now has a FillerCreative row, which is a
-- set that can only shrink: new fillers are never Campaigns.

ALTER TABLE "Store"        DROP COLUMN "fillerCampaignId";
ALTER TABLE "PlayerConfig" DROP COLUMN "fillerCampaignId";
