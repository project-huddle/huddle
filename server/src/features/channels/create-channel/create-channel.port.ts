export type CreatedChannel = {
  id: string;
  serverId: string;
  name: string;
  type: "text";
};

export type CreateChannelRepository = {
  createChannel(
    userId: string,
    serverId: string,
    name: string,
  ): Promise<CreatedChannel | null>;
};
