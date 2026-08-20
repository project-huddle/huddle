ALTER TABLE "users"
  ADD COLUMN "avatar_url" VARCHAR(500),
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(3),
  ADD COLUMN "country_code" CHAR(2),
  ADD COLUMN "age_group" VARCHAR(16),
  ADD COLUMN "age_verified_at" TIMESTAMPTZ(3),
  ADD COLUMN "age_verification_provider" VARCHAR(32),
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "server_members" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "email_tokens" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "purpose" VARCHAR(32) NOT NULL,
  "code_hash" CHAR(64) NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_tokens_user_purpose_idx" ON "email_tokens"("user_id", "purpose");

CREATE TABLE "friendships" (
  "requester_id" UUID NOT NULL, "addressee_id" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "friendships_pkey" PRIMARY KEY ("requester_id", "addressee_id"),
  CONSTRAINT "friendships_distinct_users_check" CHECK ("requester_id" <> "addressee_id"),
  CONSTRAINT "friendships_status_check" CHECK ("status" IN ('pending', 'accepted'))
);
CREATE INDEX "friendships_addressee_idx" ON "friendships"("addressee_id", "status");

CREATE TABLE "direct_messages" (
  "id" UUID NOT NULL, "sender_id" UUID NOT NULL, "recipient_id" UUID NOT NULL,
  "content" TEXT NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(3), CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "direct_messages_sender_idx" ON "direct_messages"("sender_id", "recipient_id", "created_at" DESC);
CREATE INDEX "direct_messages_recipient_idx" ON "direct_messages"("recipient_id", "sender_id", "created_at" DESC);

CREATE TABLE "reports" (
  "id" UUID NOT NULL, "reporter_id" UUID NOT NULL, "target_user_id" UUID,
  "server_id" UUID, "message_id" UUID, "reason" VARCHAR(1000) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'open', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_status_check" CHECK ("status" IN ('open', 'resolved', 'dismissed'))
);
CREATE INDEX "reports_server_idx" ON "reports"("server_id", "status", "created_at");

ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
