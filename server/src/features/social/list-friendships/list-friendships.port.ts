export type FriendshipView = {
  status: string;
  direction: "incoming" | "outgoing";
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
};

export type ListFriendshipsRepository = {
  listFriendships(userId: string): Promise<FriendshipView[]>;
};
