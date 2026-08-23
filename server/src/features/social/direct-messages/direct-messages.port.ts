export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type DirectMessagesRepository = {
  history(userId: string, peerId: string): Promise<DirectMessage[] | null>;
  areFriends(userId: string, peerId: string): Promise<boolean>;
  create(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<DirectMessage>;
};
