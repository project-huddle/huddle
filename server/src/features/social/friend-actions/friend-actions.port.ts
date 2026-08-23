export type FriendActionsRepository = {
  acceptFriend(userId: string, requesterId: string): Promise<boolean>;
  deleteFriendship(userId: string, peerId: string): Promise<void>;
};
