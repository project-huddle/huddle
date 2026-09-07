import { Prisma, PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};
export type AuthUser = User & {
  passwordHash: string;
  twoFactorEnabled: boolean;
};
export type MessageMedia = { url: string; type: "image" | "gif"; alt: string };
export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  reactions: Record<string, number>;
  author: User;
  media: MessageMedia | null;
  channelId: string;
};
export type Server = {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
};
export type Channel = {
  id: string;
  serverId: string;
  name: string;
  type: "text" | "voice";
  roleIds: string[];
};
export type ServerRole = "owner" | "moderator" | "member";
export type ServerMember = User & {
  joinedAt: string;
  role: ServerRole;
  isOwner: boolean;
  roles: { id: string; name: string; color: string; position: number }[];
};
export type ServerInvite = {
  code: string;
  serverId: string;
  expiresAt: string;
};
export type AccessibleMessage = ChatMessage & { userId: string };

export const userSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
export const messageInclude = {
  author: { select: userSelect },
  reactionEntries: { select: { emoji: true } },
} satisfies Prisma.MessageInclude;
export const userView = (user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}): User => ({ ...user, createdAt: user.createdAt.toISOString() });
export const serverView = (server: {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: Date;
}): Server => ({ ...server, createdAt: server.createdAt.toISOString() });
export const channelView = (channel: {
  id: string;
  serverId: string;
  name: string;
  type: string;
  roleAccess?: { roleId: string }[];
}): Channel => ({
  id: channel.id,
  serverId: channel.serverId,
  name: channel.name,
  type: channel.type === "voice" ? "voice" : "text",
  roleIds: channel.roleAccess?.map(({ roleId }) => roleId) ?? [],
});

export function messageView(
  message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
): ChatMessage {
  const deleted = Boolean(message.deletedAt);
  const legacy =
    message.legacyReactions &&
    typeof message.legacyReactions === "object" &&
    !Array.isArray(message.legacyReactions)
      ? (message.legacyReactions as Record<string, unknown>)
      : {};
  const reactions = Object.fromEntries(
    Object.entries(legacy).filter(
      (entry): entry is [string, number] =>
        Number.isSafeInteger(entry[1]) && Number(entry[1]) > 0,
    ),
  );
  message.reactionEntries.reduce<Record<string, number>>((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    return counts;
  }, reactions);
  return {
    id: message.id,
    channelId: message.channelId,
    content: deleted ? "" : message.content,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    replyToId: message.replyToId,
    reactions,
    author: userView(message.author),
    media:
      !deleted &&
      message.mediaUrl &&
      (message.mediaType === "image" || message.mediaType === "gif")
        ? {
            url: message.mediaUrl,
            type: message.mediaType,
            alt: message.mediaAlt ?? "Imagem enviada",
          }
        : null,
  };
}
