import { areFriends } from "./social-service";
import { messageContent, messageMedia } from "./validation";
import {
  createDirectMessage,
  listDirectMessages,
} from "@/infra/database/direct-message-repository";

export async function directMessageHistory(userId: string, peerId: string) {
  if (!(await areFriends(userId, peerId))) return null;
  return listDirectMessages(userId, peerId);
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
  return {
    type: "success",
    message: await createDirectMessage(userId, recipientId, content, media),
  };
}
