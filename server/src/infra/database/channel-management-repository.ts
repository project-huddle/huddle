import type { Prisma } from "@prisma/client";
import { db, channelView } from "./mappers";

function managedChannel(
  actorId: string,
  serverId: string,
  channelId: string,
): Prisma.ChannelWhereInput {
  return {
    id: channelId,
    serverId,
    server: {
      OR: [
        { ownerId: actorId },
        { members: { some: { userId: actorId, role: "moderator" } } },
      ],
    },
  };
}

export async function renameChannel(
  actorId: string,
  serverId: string,
  channelId: string,
  name: string,
) {
  const channels = await db.channel.updateManyAndReturn({
    where: managedChannel(actorId, serverId, channelId),
    data: { name },
  });
  const channel = channels[0];
  return channel ? channelView(channel) : null;
}

export async function deleteChannel(
  actorId: string,
  serverId: string,
  channelId: string,
) {
  const result = await db.channel.deleteMany({
    where: managedChannel(actorId, serverId, channelId),
  });
  return result.count > 0;
}
