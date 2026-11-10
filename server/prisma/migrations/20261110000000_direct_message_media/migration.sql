ALTER TABLE "direct_messages"
  ADD COLUMN "media_url" TEXT,
  ADD COLUMN "media_type" VARCHAR(16),
  ADD COLUMN "media_alt" VARCHAR(160);
