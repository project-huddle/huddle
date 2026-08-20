CREATE TABLE "message_reactions" (
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "emoji" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id", "user_id", "emoji")
);

CREATE INDEX "message_reactions_user_idx" ON "message_reactions"("user_id");

ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
