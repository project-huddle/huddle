import { canAccessMedia } from "../../media/application/media-access";
import { areFriends } from "../../social/application/social-service";
import { messageContent, messageMedia } from "./message-validation";
import { decodeDirectMessageCursor, encodeDirectMessageCursor } from "./direct-message-cursor";
import {
  createDirectMessage,
  listDirectMessages,
} from "@/features/messages/infrastructure/direct-message-repository";

export async function directMessageHistory(
  userId: string,
  peerId: string,
  options: { cursor?: string; limit?: number } = {},
) {
  if (!(await areFriends(userId, peerId))) return { type: "not-friends" as const };
  const before = options.cursor === undefined ? null : decodeDirectMessageCursor(options.cursor, userId, peerId);
  if (options.cursor !== undefined && !before) return { type: "invalid-cursor" as const };
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const page = await listDirectMessages(userId, peerId, { before, limit });
  if (page.type === "invalid-cursor") return page;
  const oldest = page.messages[0];
  const nextCursor = page.hasMore && oldest
    ? encodeDirectMessageCursor(userId, peerId, { id: oldest.id, createdAt: new Date(oldest.createdAt) })
    : null;
  return { type: "success" as const, messages: page.messages, nextCursor };
}

type SendResult =
  | {
      type: "success";
      message: Awaited<ReturnType<typeof createDirectMessage>>;
    }
  | { type: "not-friends" }
  | { type: "invalid-message" };

export async function sendDirectMessage(
  userId: string,
  recipientId: string,
  rawContent: string,
  rawMedia?: unknown,
): Promise<SendResult> {
  if (!(await areFriends(userId, recipientId))) return { type: "not-friends" };
  const content = messageContent(rawContent, true);
  const media = messageMedia(rawMedia);
  const hasInvalidMedia = rawMedia != null && !media;
  if (content === null || (!content && !media) || hasInvalidMedia)
    return { type: "invalid-message" };
  if (media?.url.startsWith("/media/") && !(await canAccessMedia(media.url, userId))) return {type:"invalid-message"};
  return {
    type: "success",
    message: await createDirectMessage(userId, recipientId, content, media),
  };
}
