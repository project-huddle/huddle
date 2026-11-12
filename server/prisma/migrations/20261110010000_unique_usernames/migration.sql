ALTER TABLE "users" ADD COLUMN "username" VARCHAR(40);
UPDATE "users" SET "username" = 'user_' || replace("id"::text, '-', '');
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET DEFAULT ('user_' || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
ALTER TABLE "users" ADD CONSTRAINT "users_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,40}$');
