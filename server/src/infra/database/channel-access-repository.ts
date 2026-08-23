import type { ChannelAccess } from "../../features/channels/channel-access.port";
import { db } from "./mappers";

export function createChannelAccessRepository(): ChannelAccess {
  return {
    async channelForUser(userId, channelId) {
      return db.channel.findFirst({
        where: { id: channelId, server: { members: { some: { userId } } } },
        select: { id: true },
      });
    },
    async firstChannelForUser(userId) {
      return db.channel.findFirst({
        where: { server: { members: { some: { userId } } } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
    },
  };
}
