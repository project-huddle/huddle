import { publicProfile } from "@/core/identity/public-profile";
import { Prisma, PrismaClient } from "@prisma/client";
import type { User } from "@/features/auth/types/user";
import type { ChatMessage } from "@/features/messages/types/message";
import type { Channel, Server } from "@/features/servers/types/server";

export const db = new PrismaClient();

export const userSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
export const messageInclude = {
  author: { select: userSelect },
  reactionEntries: { select: { emoji: true } },
} satisfies Prisma.MessageInclude;
export const userView = (user: {
  username: string;
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
    author: publicProfile(userView(message.author)),
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
