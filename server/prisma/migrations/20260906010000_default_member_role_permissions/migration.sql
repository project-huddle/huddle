INSERT INTO "permission_definitions" ("key", "label", "description", "category") VALUES
  ('channels.view', 'Visualizar canais', 'Visualizar canais públicos e autorizados', 'canais'),
  ('invites.create', 'Criar convites', 'Criar convites para o servidor', 'membros'),
  ('members.view', 'Visualizar membros', 'Visualizar membros do servidor', 'membros'),
  ('messages.send', 'Enviar mensagens', 'Enviar mensagens em canais de texto', 'mensagens'),
  ('voice.camera', 'Usar câmera', 'Transmitir vídeo próprio', 'voz'),
  ('voice.connect', 'Entrar em chamadas', 'Entrar em canais de voz', 'voz'),
  ('voice.screen_share', 'Compartilhar tela', 'Compartilhar tela própria', 'voz'),
  ('voice.speak', 'Usar microfone', 'Transmitir áudio próprio', 'voz')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "server_role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "server_roles" r
CROSS JOIN "permission_definitions" p
WHERE r."is_default" = true
  AND p."key" IN (
    'channels.view', 'invites.create', 'members.view', 'messages.send',
    'voice.camera', 'voice.connect', 'voice.screen_share', 'voice.speak'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "server_member_roles" ("server_id", "user_id", "role_id")
SELECT sm."server_id", sm."user_id", r."id"
FROM "server_members" sm
JOIN "server_roles" r
  ON r."server_id" = sm."server_id" AND r."is_default" = true
ON CONFLICT DO NOTHING;
