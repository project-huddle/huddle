import type { Prisma } from "@prisma/client";
import { db, channelView } from "./mappers";
import { hasServerPermission } from "./server-repository";

async function managedChannel(
  actorId: string,
  serverId: string,
  channelId: string,
  permission: "channels.manage" | "channels.delete",
): Promise<Prisma.ChannelWhereInput | null> {
  const canManage = await hasServerPermission(actorId, serverId, permission);
  if (!canManage) return null;
  return {
    id: channelId,
    serverId,
  };
}

export async function renameChannel(
  actorId: string,
  serverId: string,
  channelId: string,
  name: string,
) {
  const where = await managedChannel(actorId, serverId, channelId, "channels.manage");
  if (!where) return null;
  const channels = await db.channel.updateManyAndReturn({
    where,
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
  const where = await managedChannel(actorId, serverId, channelId, "channels.delete");
  if (!where) return false;
  const result = await db.channel.deleteMany({
    where,
  });
  return result.count > 0;
}
