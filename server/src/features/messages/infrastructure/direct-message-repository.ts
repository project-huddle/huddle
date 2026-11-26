import type { DirectMessage } from "@prisma/client";
import { db } from "../../../shared/infrastructure/database/client";
import type { MessageMedia } from "@/features/messages/types/message";

function directMessageView(row: DirectMessage) {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    media:
      row.mediaUrl && (row.mediaType === "image" || row.mediaType === "gif")
        ? {
            url: row.mediaUrl,
            type: row.mediaType,
            alt: row.mediaAlt ?? "Imagem enviada",
          }
        : null,
  };
}

export async function listDirectMessages(
  userId: string,
  peerId: string,
  options: { limit: number; before: { id: string; createdAt: Date } | null },
) {
  const participants = {
    OR: [
      { senderId: userId, recipientId: peerId },
      { senderId: peerId, recipientId: userId },
    ],
  };
  const { before } = options;
  const limit = Math.min(options.limit, 100);
  if (before) {
    const anchor = await db.directMessage.findFirst({
      where: { ...participants, id: before.id, createdAt: before.createdAt },
      select: { id: true },
    });
    if (!anchor) return { type: "invalid-cursor" as const };
  }
  const messages = await db.directMessage.findMany({
    where: {
      ...participants,
      ...(before && {
        AND: [
          {
            OR: [
              { createdAt: { lt: before.createdAt } },
              { createdAt: before.createdAt, id: { lt: before.id } },
            ],
          },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = messages.length > limit;
  return {
    type: "success" as const,
    messages: messages.slice(0, limit).reverse().map(directMessageView),
    hasMore,
  };
}

export async function createDirectMessage(
  senderId: string,
  recipientId: string,
  content: string,
  media: MessageMedia | null,
) {
  const created = await db.directMessage.create({
    data: {
      senderId,
      recipientId,
      content,
      mediaUrl: media?.url,
      mediaType: media?.type,
      mediaAlt: media?.alt,
    },
  });
  return directMessageView(created);
}
