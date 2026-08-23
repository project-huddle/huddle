import { messageContent } from "../../../validation";
import type { DirectMessagesRepository } from "./direct-messages.port";

export function directMessageHistory(
  repository: DirectMessagesRepository,
  userId: string,
  peerId: string,
) {
  return repository.history(userId, peerId);
}

export type SendDirectMessageResult =
  | {
      type: "success";
      message: Awaited<ReturnType<DirectMessagesRepository["create"]>>;
    }
  | { type: "not-friends" }
  | { type: "invalid-message" };

export async function sendDirectMessage(
  repository: DirectMessagesRepository,
  userId: string,
  recipientId: string,
  rawContent: string,
): Promise<SendDirectMessageResult> {
  if (!(await repository.areFriends(userId, recipientId)))
    return { type: "not-friends" };
  const content = messageContent(rawContent);
  if (!content) return { type: "invalid-message" };
  return {
    type: "success",
    message: await repository.create(userId, recipientId, content),
  };
}
