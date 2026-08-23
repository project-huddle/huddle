import type { MessageActions } from "../../features/messages/message-actions.port";
import {
  deleteMessage,
  editMessage,
  messageForUser,
  reactMessage,
  saveMessage,
} from "./message-repository";
import type { User } from "./mappers";

export function createMessageActionsRepository(): MessageActions {
  return {
    saveMessage: (user, channelId, content, media, replyToId) =>
      saveMessage(user as User, channelId, content, media, replyToId),
    messageForUser,
    editMessage,
    deleteMessage,
    reactMessage,
  };
}
