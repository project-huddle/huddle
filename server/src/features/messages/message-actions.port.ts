export type MessageUser = { id: string };
export type MessageMedia = { url: string; type: "image" | "gif"; alt: string };
export type MessageAccess = { id: string; channelId: string; userId: string };

export type MessageActions = {
  saveMessage(
    user: MessageUser,
    channelId: string,
    content: string,
    media: MessageMedia | null,
    replyToId: string | null,
  ): Promise<unknown>;
  messageForUser(
    userId: string,
    messageId: string,
  ): Promise<MessageAccess | null>;
  editMessage(
    userId: string,
    messageId: string,
    content: string,
  ): Promise<unknown | null>;
  deleteMessage(userId: string, messageId: string): Promise<unknown | null>;
  reactMessage(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<unknown | null>;
};
