export type CreatedInvite = {
  code: string;
  serverId: string;
  expiresAt: string;
};

export type CreateInviteRepository = {
  createInvite(userId: string, serverId: string): Promise<CreatedInvite | null>;
};
