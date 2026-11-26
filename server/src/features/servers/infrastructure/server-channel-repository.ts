import type { Prisma } from "@prisma/client";
import { db, channelView } from "../../../shared/infrastructure/database/mappers";
import type { Channel } from "@/features/servers/types/server";
import { hasServerPermission } from "./server-member-repository";

async function managedChannel(
  actorId: string,
  serverId: string,
  channelId: string,
  permission: "channels.manage" | "channels.delete",
): Promise<Prisma.ChannelWhereInput | null> {
  const canManage = await hasServerPermission(actorId, serverId, permission);
  if (!canManage) return null;
  return { id: channelId, serverId };
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
  const result = await db.channel.deleteMany({ where });
  return result.count > 0;
}

export async function listChannels(
  userId: string,
  serverId: string,
): Promise<Channel[]> {
  if (!(await hasServerPermission(userId, serverId, "channels.view"))) return [];
  return (
    await db.channel.findMany({
      where: {
        serverId,
        server: { members: { some: { userId } } },
        OR: [
          { roleAccess: { none: {} } },
          { roleAccess: { some: { role: { members: { some: { userId } } } } } },
          { server: { ownerId: userId } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { roleAccess: { select: { roleId: true } } },
    })
  ).map(channelView);
}
export async function updateChannelAccess(actorId: string, serverId: string, channelId: string, roleIds: string[]) {
  if (!(await hasServerPermission(actorId, serverId, "channels.access.manage"))) return false;
  const channel = await db.channel.findFirst({ where: { id: channelId, serverId } });
  if (!channel) return false;
  const validRoles = await db.serverRole.findMany({ where: { id: { in: roleIds }, serverId }, select: { id: true } });
  await db.$transaction([db.channelRoleAccess.deleteMany({ where: { channelId } }), db.channelRoleAccess.createMany({ data: validRoles.map(({ id: roleId }) => ({ channelId, roleId })) })]);
  return true;
}
export async function channelForUserWithAccess(userId: string, channelId: string) {
  return channelForUser(userId, channelId);
}
export async function createChannel(
  userId: string,
  serverId: string,
  name: string,
  type: "text" | "voice" = "text",
): Promise<Channel | null> {
  if (!(await hasServerPermission(userId, serverId, "channels.create")))
    return null;
  return channelView(await db.channel.create({ data: { serverId, name, type } }));
}
export async function channelForUser(
  userId: string,
  channelId: string,
): Promise<Channel | null> {
  if (!(await hasServerPermission(userId, (await db.channel.findUnique({ where: { id: channelId }, select: { serverId: true } }))?.serverId ?? "", "channels.view"))) return null;
  const channel = await db.channel.findFirst({
    where: {
      id: channelId,
      server: { members: { some: { userId } } },
      OR: [
        { roleAccess: { none: {} } },
        { roleAccess: { some: { role: { members: { some: { userId } } } } } },
        { server: { ownerId: userId } },
      ],
    },
    include: { roleAccess: { select: { roleId: true } } },
  });
  return channel ? channelView(channel) : null;
}
export async function firstChannelForUser(
  userId: string,
): Promise<Channel | null> {
  const userServers = await db.server.findMany({
    where: { members: { some: { userId } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const permittedServers = await Promise.all(
    userServers.map(async ({ id }) =>
      (await hasServerPermission(userId, id, "channels.view")) ? id : null,
    ),
  );
  const serverIds = permittedServers.filter((id): id is string => id !== null);
  if (!serverIds.length) return null;
  const channel = await db.channel.findFirst({
    where: {
      serverId: { in: serverIds },
      OR: [
        { roleAccess: { none: {} } },
        { roleAccess: { some: { role: { members: { some: { userId } } } } } },
        { server: { ownerId: userId } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { roleAccess: { select: { roleId: true } } },
  });
  return channel ? channelView(channel) : null;
}
