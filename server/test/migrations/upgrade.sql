-- Run only against a new disposable database with psql --set=ON_ERROR_STOP=1.
\ir ../../prisma/migrations/20260819000000_init/migration.sql
\ir ../../prisma/migrations/20260820000000_message_reactions/migration.sql
\ir ../../prisma/migrations/20260820020000_identity_social_moderation/migration.sql
\ir ../../prisma/migrations/20260822000000_remove_age_verification/migration.sql
\ir ../../prisma/migrations/20260904000000_voice_channels/migration.sql
\ir ../../prisma/migrations/20260904010000_server_icon/migration.sql
\ir ../../prisma/migrations/20260906000000_server_roles_and_access/migration.sql
\ir ../../prisma/migrations/20260906010000_default_member_role_permissions/migration.sql
\ir ../../prisma/migrations/20260907000000_call_device_preferences/migration.sql
\ir ../../prisma/migrations/20260907010000_complete_permission_definitions/migration.sql

-- Duplicate display names and case-different emails must not cause username collisions.
INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Alice@example.com', 'Same Name', 'legacy-hash'),
  ('22222222-2222-4222-8222-222222222222', 'alice@example.com', 'Same Name', 'legacy-hash');
INSERT INTO sessions (token_hash, user_id, expires_at) VALUES
  (repeat('a', 64), '11111111-1111-4111-8111-111111111111', CURRENT_TIMESTAMP + INTERVAL '1 day');
INSERT INTO friendships (requester_id, addressee_id, status, updated_at) VALUES
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'accepted', CURRENT_TIMESTAMP);
INSERT INTO direct_messages (id, sender_id, recipient_id, content) VALUES
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Preserve this legacy message');

\ir ../../prisma/migrations/20261110000000_direct_message_media/migration.sql
\ir ../../prisma/migrations/20261110010000_unique_usernames/migration.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM users WHERE username = 'user_' || replace(id::text, '-', '')) <> 2 THEN
    RAISE EXCEPTION 'Existing users did not receive deterministic distinct usernames';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE content = 'Preserve this legacy message'
      AND media_url IS NULL AND media_type IS NULL AND media_alt IS NULL) THEN
    RAISE EXCEPTION 'Legacy direct message was changed by media migration';
  END IF;
  IF (SELECT count(*) FROM sessions) <> 1 OR (SELECT count(*) FROM friendships) <> 1 THEN
    RAISE EXCEPTION 'Session or friendship relationships were lost';
  END IF;

  BEGIN
    UPDATE users SET username = 'user_11111111111141118111111111111111'
    WHERE id = '22222222-2222-4222-8222-222222222222';
    RAISE EXCEPTION 'Duplicate usernames were accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE users SET username = 'Invalid Username!';
    RAISE EXCEPTION 'Invalid usernames were accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('44444444-4444-4444-8444-444444444444', 'new@example.com', 'New User', 'new-hash');
UPDATE direct_messages SET media_url = '/media/fixture.png', media_type = 'image', media_alt = 'Fixture image'
WHERE id = '33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'new@example.com' AND username ~ '^user_[a-f0-9]{32}$') THEN
    RAISE EXCEPTION 'New users did not receive a valid default username';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE media_url = '/media/fixture.png'
      AND media_type = 'image' AND media_alt = 'Fixture image') THEN
    RAISE EXCEPTION 'Media columns cannot store a new message attachment';
  END IF;
END $$;
\echo 'Populated legacy migration validation passed.'
