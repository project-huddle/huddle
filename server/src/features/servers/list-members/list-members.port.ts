export type ListedMember = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  joinedAt: string;
  role: "owner" | "moderator" | "member";
  isOwner: boolean;
};

export type ListMembersRepository = {
  listMembers(userId: string, serverId: string): Promise<ListedMember[] | null>;
};
