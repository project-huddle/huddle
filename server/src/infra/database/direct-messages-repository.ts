import type { DirectMessagesRepository } from "../../features/social/direct-messages/direct-messages.port";
import { db } from "./client";

export function createDirectMessagesRepository(): DirectMessagesRepository {
  return {
    async areFriends(userId, peerId) {
      return Boolean(
        await db.friendship.findFirst({
          where: {
            status: "accepted",
            OR: [
              { requesterId: userId, addresseeId: peerId },
              { requesterId: peerId, addresseeId: userId },
            ],
          },
          select: { requesterId: true },
        }),
      );
    },
    async history(userId, peerId) {
      if (!(await this.areFriends(userId, peerId))) return null;
      const messages = await db.directMessage.findMany({
        where: {
          OR: [
            { senderId: userId, recipientId: peerId },
            { senderId: peerId, recipientId: userId },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      return messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
      }));
    },
    async create(senderId, recipientId, content) {
      const message = await db.directMessage.create({
        data: { senderId, recipientId, content },
      });
      return {
        ...message,
        createdAt: message.createdAt.toISOString(),
        readAt: null,
      };
    },
  };
}
