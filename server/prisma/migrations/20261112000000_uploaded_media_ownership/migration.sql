CREATE TABLE "uploaded_media" (
  "filename" VARCHAR(80) PRIMARY KEY,
  "owner_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content_type" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "uploaded_media_owner_idx" ON "uploaded_media"("owner_id");
-- Legacy files intentionally have no inferred owner. Existing message/profile references
-- remain the authorization source; unreferenced legacy files are inaccessible.
