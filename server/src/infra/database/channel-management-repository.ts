import type { Prisma } from "@prisma/client";
import { db, channelView } from "./mappers";
import { hasServerPermission } from "./server-repository";

async function managedChannel(
  actorId: string,
  serverId: string,
  channelId: string,
): Promise<Prisma.ChannelWhereInput> {
  const canManage = await hasServerPermission(actorId, serverId, "channels.manage");
  return {
    id: channelId,
    serverId,
    ...(canManage ? {} : { id: "__forbidden__" }),
  };
}

export async function renameChannel(
  actorId: string,
  serverId: string,
  channelId: string,
  name: string,
) {
  const channels = await db.channel.updateManyAndReturn({
    where: await managedChannel(actorId, serverId, channelId),
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
    where: await managedChannel(actorId, serverId, channelId),
  });
  return result.count > 0;
}
