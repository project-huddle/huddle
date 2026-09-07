import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const permissionDefinitions = [
  ["server.view", "Visualizar servidor", "Acessar o servidor", "servidor"],
  ["server.settings.manage", "Gerenciar servidor", "Alterar nome e ícone do servidor", "servidor"],
  ["channels.view", "Visualizar canais", "Visualizar canais públicos e autorizados", "canais"],
  ["channels.create", "Criar canais", "Criar canais de texto e voz", "canais"],
  ["channels.manage", "Gerenciar canais", "Renomear e editar canais", "canais"],
  ["channels.delete", "Excluir canais", "Excluir canais", "canais"],
  ["channels.access.manage", "Gerenciar acesso de canais", "Configurar canais privados", "canais"],
  ["roles.create", "Criar cargos", "Criar novos cargos", "cargos"],
  ["roles.manage", "Gerenciar cargos", "Editar e excluir cargos", "cargos"],
  ["members.view", "Visualizar membros", "Visualizar membros do servidor", "membros"],
  ["members.manage_roles", "Atribuir cargos", "Atribuir e remover cargos de membros", "membros"],
  ["members.kick", "Remover membros", "Remover membros do servidor", "membros"],
  ["members.ban", "Banir membros", "Banir membros do servidor", "membros"],
  ["invites.create", "Criar convites", "Criar convites para o servidor", "membros"],
  ["messages.send", "Enviar mensagens", "Enviar mensagens em canais de texto", "mensagens"],
  ["messages.moderate", "Moderar mensagens", "Editar e remover mensagens de outros usuários", "mensagens"],
  ["reports.review", "Revisar denúncias", "Visualizar e tratar denúncias", "moderação"],
  ["voice.connect", "Entrar em chamadas", "Entrar em canais de voz", "voz"],
  ["voice.speak", "Usar microfone", "Transmitir áudio próprio", "voz"],
  ["voice.camera", "Usar câmera", "Transmitir vídeo próprio", "voz"],
  ["voice.screen_share", "Compartilhar tela", "Compartilhar tela própria", "voz"],
  ["voice.moderate_mute", "Silenciar membros", "Silenciar microfones de outros membros", "voz"],
  ["voice.moderate_camera", "Desativar câmeras", "Desativar câmeras de outros membros", "voz"],
  ["voice.moderate_screen_share", "Bloquear telas", "Impedir compartilhamento de tela de outros membros", "voz"],
  ["voice.disconnect", "Remover da chamada", "Remover membros de chamadas", "voz"],
] as const;

await Promise.all(
  permissionDefinitions.map(([key, label, description, category]) =>
    db.permissionDefinition.upsert({
      where: { key },
      create: { key, label, description, category },
      update: { label, description, category },
    }),
  ),
);

await db.$disconnect();
