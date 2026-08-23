import type { ListChannelsRepository } from "../../features/channels/list-channels/list-channels.port";
import { channelView, db } from "./mappers";

export function createListChannelsRepository(): ListChannelsRepository {
  return {
    async listChannels(userId, serverId) {
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId } },
        select: { userId: true },
      });
      if (!member) return { authorized: false, channels: [] };

      const channels = await db.channel.findMany({
        where: { serverId },
        orderBy: { createdAt: "asc" },
      });
      return { authorized: true, channels: channels.map(channelView) };
    },
  };
}
