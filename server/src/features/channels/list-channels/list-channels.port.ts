import type { CreatedChannel } from "../create-channel/create-channel.port";

export type ListChannelsRepository = {
  listChannels(
    userId: string,
    serverId: string,
  ): Promise<{ authorized: boolean; channels: CreatedChannel[] }>;
};
