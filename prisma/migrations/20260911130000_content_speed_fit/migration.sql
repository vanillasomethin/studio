-- Receipt for a transcode-time retime onto a slot boundary.
--
-- Nullable with no default and never backfilled: null means "not retimed", which is
-- the truth for every row that exists today. Adding a nullable column with no default
-- does not rewrite the table.

ALTER TABLE "Content" ADD COLUMN "speedFittedFromMs" INTEGER;
