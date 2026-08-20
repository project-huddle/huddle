import {
  db,
  messageInclude,
  messageView,
  type AccessibleMessage,
  type ChatMessage,
  type MessageMedia,
  type User,
} from "./mappers";

export type { AccessibleMessage, ChatMessage, MessageMedia } from "./mappers";

export async function saveMessage(
  user: User,
  channelId: string,
  content: string,
  media: MessageMedia | null = null,
  replyToId: string | null = null,
): Promise<ChatMessage> {
  return messageView(
    await db.message.create({
      data: {
        userId: user.id,
        channelId,
        content,
        replyToId,
        mediaUrl: media?.url,
        mediaType: media?.type,
        mediaAlt: media?.alt,
      },
      include: messageInclude,
    }),
  );
}
export async function messageHistory(
  channelId: string,
  limit: number,
  before?: string,
): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: {
      channelId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: messageInclude,
  });
  return rows.reverse().map(messageView);
}
export async function messageForUser(
  userId: string,
  messageId: string,
): Promise<AccessibleMessage | null> {
  const row = await db.message.findFirst({
    where: {
      id: messageId,
      channel: { server: { members: { some: { userId } } } },
    },
    include: messageInclude,
  });
  return row ? { ...messageView(row), userId: row.userId } : null;
}
export async function editMessage(
  userId: string,
  messageId: string,
  content: string,
): Promise<ChatMessage | null> {
  const row = await messageForUser(userId, messageId);
  if (!row || row.userId !== userId || row.deletedAt) return null;
  return messageView(
    await db.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: messageInclude,
    }),
  );
}
export async function deleteMessage(
  userId: string,
  messageId: string,
): Promise<ChatMessage | null> {
  const row = await messageForUser(userId, messageId);
  if (!row || row.userId !== userId || row.deletedAt) return null;
  return messageView(
    await db.message.update({
      where: { id: messageId },
      data: {
        content: "",
        mediaUrl: null,
        mediaType: null,
        mediaAlt: null,
        deletedAt: new Date(),
      },
      include: messageInclude,
    }),
  );
}
export async function reactMessage(
  userId: string,
  messageId: string,
  emoji: string,
): Promise<ChatMessage | null> {
  if (!/\p{Extended_Pictographic}/u.test(emoji) || emoji.length > 8)
    return null;
  return db.$transaction(async (tx) => {
    const message = await tx.message.findFirst({
      where: {
        id: messageId,
        deletedAt: null,
        channel: { server: { members: { some: { userId } } } },
      },
      select: { id: true },
    });
    if (!message) return null;
    const key = { messageId_userId_emoji: { messageId, userId, emoji } };
    const existing = await tx.messageReaction.findUnique({
      where: key,
      select: { messageId: true },
    });
    if (existing) await tx.messageReaction.delete({ where: key });
    else
      await tx.messageReaction.create({ data: { messageId, userId, emoji } });
    return messageView(
      await tx.message.findUniqueOrThrow({
        where: { id: messageId },
        include: messageInclude,
      }),
    );
  });
}
