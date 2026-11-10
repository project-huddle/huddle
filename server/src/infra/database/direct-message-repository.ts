import type { DirectMessage } from "@prisma/client";
import { db } from "./client";
import type { MessageMedia } from "./mappers";

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

export async function listDirectMessages(userId: string, peerId: string) {
  const messages = await db.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: peerId },
        { senderId: peerId, recipientId: userId },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return messages.reverse().map(directMessageView);
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
