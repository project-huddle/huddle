export type AccessibleChannel = { id: string };

export type ChannelAccess = {
  channelForUser(
    userId: string,
    channelId: string,
  ): Promise<AccessibleChannel | null>;
  firstChannelForUser(userId: string): Promise<AccessibleChannel | null>;
};
