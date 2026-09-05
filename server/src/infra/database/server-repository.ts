import {
  db,
  channelView,
  serverView,
  userSelect,
  userView,
  type Channel,
  type Server,
  type ServerInvite,
  type ServerMember,
  type ServerRole,
  type User,
} from "./mappers";
import { can, type Permission } from "@/core/moderation/permissions";

export type {
  Channel,
  Server,
  ServerInvite,
  ServerMember,
  ServerRole,
} from "./mappers";

export async function createServer(
  user: User,
  name: string,
): Promise<{ server: Server; channel: Channel }> {
  const result = await db.server.create({
    data: {
      name,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "owner" } },
      channels: { create: { name: "geral" } },
    },
    include: { channels: true },
  });
  return {
    server: serverView(result),
    channel: channelView(result.channels[0]!),
  };
}
export async function listServers(userId: string): Promise<Server[]> {
  return (
    await db.server.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    })
  ).map(serverView);
}
export async function listChannels(
  userId: string,
  serverId: string,
): Promise<Channel[]> {
  return (
    await db.channel.findMany({
      where: { serverId, server: { members: { some: { userId } } } },
      orderBy: { createdAt: "asc" },
    })
  ).map(channelView);
}
export async function isServerMember(
  userId: string,
  serverId: string,
): Promise<boolean> {
  return Boolean(
    await db.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      select: { userId: true },
    }),
  );
}
export async function serverForUser(
  userId: string,
  serverId: string,
): Promise<Server | null> {
  const server = await db.server.findFirst({
    where: { id: serverId, members: { some: { userId } } },
  });
  return server ? serverView(server) : null;
}
export async function serverMembers(
  userId: string,
  serverId: string,
): Promise<ServerMember[] | null> {
  if (!(await isServerMember(userId, serverId))) return null;
  const rows = await db.serverMember.findMany({
    where: { serverId },
    include: {
      user: { select: userSelect },
      server: { select: { ownerId: true } },
    },
  });
  const priority: Record<ServerRole, number> = {
    owner: 0,
    moderator: 1,
    member: 2,
  };
  return rows
    .map((row) => ({
      ...userView(row.user),
      joinedAt: row.createdAt.toISOString(),
      role: row.role as ServerRole,
      isOwner: row.userId === row.server.ownerId,
    }))
    .sort(
      (a, b) =>
        priority[a.role] - priority[b.role] ||
        a.displayName.localeCompare(b.displayName),
    );
}
export async function roleForUser(
  userId: string,
  serverId: string,
): Promise<ServerRole | null> {
  const row = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { role: true },
  });
  return row ? (row.role as ServerRole) : null;
}
export async function canManageServer(
  userId: string,
  serverId: string,
): Promise<boolean> {
  const member = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { role: true, permissions: true },
  });
  return Boolean(
    member &&
    (can(member.role as ServerRole, "channels.create", member.permissions) ||
      can(member.role as ServerRole, "invites.create", member.permissions)),
  );
}

export async function hasServerPermission(
  userId: string,
  serverId: string,
  permission: Permission,
): Promise<boolean> {
  const member = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { role: true, permissions: true },
  });
  return Boolean(
    member && can(member.role as ServerRole, permission, member.permissions),
  );
}
export async function setMemberRole(
  actorId: string,
  serverId: string,
  memberId: string,
  role: "moderator" | "member",
): Promise<"ok" | "forbidden" | "missing"> {
  const server = await serverForUser(actorId, serverId);
  if (!server || server.ownerId !== actorId)
    return server ? "forbidden" : "missing";
  if (
    !(await isServerMember(memberId, serverId)) ||
    memberId === server.ownerId
  )
    return "missing";
  await db.serverMember.update({
    where: { serverId_userId: { serverId, userId: memberId } },
    data: { role },
  });
  return "ok";
}
export async function removeMember(
  actorId: string,
  serverId: string,
  memberId: string,
): Promise<"ok" | "forbidden" | "missing"> {
  const server = await serverForUser(actorId, serverId);
  if (!server || server.ownerId !== actorId)
    return server ? "forbidden" : "missing";
  if (
    !(await isServerMember(memberId, serverId)) ||
    memberId === server.ownerId
  )
    return "missing";
  await db.serverMember.delete({
    where: { serverId_userId: { serverId, userId: memberId } },
  });
  return "ok";
}
export async function createInvite(
  userId: string,
  serverId: string,
  durationHours = 2,
): Promise<ServerInvite | null> {
  const member = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { role: true },
  });
  if (!member || !can(member.role as ServerRole, "invites.create"))
    return null;
  if (!Number.isSafeInteger(durationHours) || durationHours < 1) return null;
  if (member.role !== "owner" && durationHours !== 2) return null;
  const invite = await db.invite.create({
    data: {
      code: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
      serverId,
      createdBy: userId,
      expiresAt: new Date(Date.now() + durationHours * 3_600_000),
    },
  });
  return {
    code: invite.code,
    serverId,
    expiresAt: invite.expiresAt.toISOString(),
  };
}
export async function leaveServer(
  userId: string,
  serverId: string,
): Promise<"left" | "owner" | "missing"> {
  const server = await serverForUser(userId, serverId);
  if (!server) return "missing";
  if (server.ownerId === userId) return "owner";
  await db.serverMember.delete({
    where: { serverId_userId: { serverId, userId } },
  });
  return "left";
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
  const channel = await db.channel.findFirst({
    where: { id: channelId, server: { members: { some: { userId } } } },
  });
  return channel ? channelView(channel) : null;
}
export async function firstChannelForUser(
  userId: string,
): Promise<Channel | null> {
  const channel = await db.channel.findFirst({
    where: { server: { members: { some: { userId } } } },
    orderBy: { createdAt: "asc" },
  });
  return channel ? channelView(channel) : null;
}
