export type FriendUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type RequestFriendRepository = {
  findUserByEmail(email: string): Promise<FriendUser | null>;
  hasReverseRequest(userId: string, targetId: string): Promise<boolean>;
  createRequest(userId: string, targetId: string): Promise<void>;
};
