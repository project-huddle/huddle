CREATE TABLE "permission_definitions" (
  "key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_definitions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "server_roles" (
  "id" UUID NOT NULL,
  "server_id" UUID NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "color" VARCHAR(7) NOT NULL DEFAULT '#64748b',
  "position" INTEGER NOT NULL DEFAULT 0,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "server_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "server_roles_server_id_name_key" ON "server_roles"("server_id", "name");
CREATE INDEX "server_roles_position_idx" ON "server_roles"("server_id", "position");

CREATE TABLE "server_role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_key" VARCHAR(80) NOT NULL,
  CONSTRAINT "server_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_key")
);

CREATE TABLE "server_member_roles" (
  "server_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "server_member_roles_pkey" PRIMARY KEY ("server_id", "user_id", "role_id")
);
CREATE INDEX "server_member_roles_role_idx" ON "server_member_roles"("role_id");

CREATE TABLE "channel_role_access" (
  "channel_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "channel_role_access_pkey" PRIMARY KEY ("channel_id", "role_id")
);
CREATE INDEX "channel_role_access_role_idx" ON "channel_role_access"("role_id");

CREATE TABLE "server_bans" (
  "server_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "server_bans_pkey" PRIMARY KEY ("server_id", "user_id")
);
CREATE INDEX "server_bans_user_idx" ON "server_bans"("user_id");

ALTER TABLE "server_roles" ADD CONSTRAINT "server_roles_server_id_fkey"
  FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_role_permissions" ADD CONSTRAINT "server_role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "server_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_role_permissions" ADD CONSTRAINT "server_role_permissions_permission_key_fkey"
  FOREIGN KEY ("permission_key") REFERENCES "permission_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_member_fkey"
  FOREIGN KEY ("server_id", "user_id") REFERENCES "server_members"("server_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "server_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_role_access" ADD CONSTRAINT "channel_role_access_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_role_access" ADD CONSTRAINT "channel_role_access_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "server_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_bans" ADD CONSTRAINT "server_bans_server_id_fkey"
  FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_bans" ADD CONSTRAINT "server_bans_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_bans" ADD CONSTRAINT "server_bans_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "server_roles" ("id", "server_id", "name", "color", "position", "is_default", "updated_at")
SELECT gen_random_uuid(), s."id", 'Membro', '#64748b', 0, true, CURRENT_TIMESTAMP FROM "servers" s
WHERE NOT EXISTS (SELECT 1 FROM "server_roles" r WHERE r."server_id" = s."id" AND r."is_default" = true);

INSERT INTO "server_member_roles" ("server_id", "user_id", "role_id")
SELECT sm."server_id", sm."user_id", r."id"
FROM "server_members" sm JOIN "server_roles" r ON r."server_id" = sm."server_id" AND r."is_default" = true
WHERE sm."role" = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO "server_member_roles" ("server_id", "user_id", "role_id")
SELECT sm."server_id", sm."user_id", r."id"
FROM "server_members" sm JOIN "server_roles" r ON r."server_id" = sm."server_id" AND r."is_default" = true
WHERE sm."role" = 'moderator'
ON CONFLICT DO NOTHING;

INSERT INTO "server_roles" ("id", "server_id", "name", "color", "position", "is_default", "updated_at")
SELECT gen_random_uuid(), s."id", 'Moderador', '#5865f2', 10, false, CURRENT_TIMESTAMP FROM "servers" s
WHERE EXISTS (SELECT 1 FROM "server_members" sm WHERE sm."server_id" = s."id" AND sm."role" = 'moderator')
  AND NOT EXISTS (SELECT 1 FROM "server_roles" r WHERE r."server_id" = s."id" AND r."name" = 'Moderador');

INSERT INTO "server_member_roles" ("server_id", "user_id", "role_id")
SELECT sm."server_id", sm."user_id", r."id"
FROM "server_members" sm JOIN "server_roles" r ON r."server_id" = sm."server_id" AND r."name" = 'Moderador'
WHERE sm."role" = 'moderator'
ON CONFLICT DO NOTHING;
