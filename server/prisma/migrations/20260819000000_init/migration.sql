CREATE TABLE "users" (
  "id" UUID NOT NULL, "email" VARCHAR(254) NOT NULL, "display_name" VARCHAR(32) NOT NULL,
  "password_hash" TEXT NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "sessions" (
  "token_hash" CHAR(64) NOT NULL, "user_id" UUID NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);
CREATE INDEX "sessions_expiry_idx" ON "sessions"("expires_at");

CREATE TABLE "servers" (
  "id" UUID NOT NULL, "name" VARCHAR(40) NOT NULL, "owner_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "server_members" (
  "server_id" UUID NOT NULL, "user_id" UUID NOT NULL, "role" VARCHAR(16) NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "server_members_pkey" PRIMARY KEY ("server_id", "user_id"),
  CONSTRAINT "server_members_role_check" CHECK ("role" IN ('owner', 'moderator', 'member'))
);
CREATE INDEX "server_members_user_idx" ON "server_members"("user_id");

CREATE TABLE "invites" (
  "code" VARCHAR(16) NOT NULL, "server_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "invites_pkey" PRIMARY KEY ("code")
);
CREATE TABLE "channels" (
  "id" UUID NOT NULL, "server_id" UUID NOT NULL, "name" VARCHAR(32) NOT NULL, "type" VARCHAR(16) NOT NULL DEFAULT 'text',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channels_type_check" CHECK ("type" = 'text')
);
CREATE INDEX "channels_server_idx" ON "channels"("server_id", "created_at");

CREATE TABLE "messages" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "edited_at" TIMESTAMPTZ(3), "deleted_at" TIMESTAMPTZ(3),
  "reply_to_id" UUID, "reactions" JSONB NOT NULL DEFAULT '{}', "media_url" TEXT, "media_type" VARCHAR(16), "media_alt" VARCHAR(160),
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"), CONSTRAINT "messages_media_type_check" CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'gif'))
);
CREATE INDEX "messages_created_idx" ON "messages"("channel_id", "created_at" DESC, "id" DESC);

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channels" ADD CONSTRAINT "channels_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
