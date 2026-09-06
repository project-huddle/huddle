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
import { permissions as knownPermissions } from "@/core/moderation/permissions";

export type {
  Channel,
  Server,
  ServerInvite,
  ServerMember,
  ServerRole,
} from "./mappers";

export type RoleDefinition = {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  permissions: string[];
};

const roleInclude = { permissions: { select: { permissionKey: true } } } as const;
const baselineMemberPermissions = new Set<Permission>([
  "server.view",
  "channels.view",
  "messages.send",
  "voice.connect",
  "voice.speak",
  "voice.camera",
  "voice.screen_share",
]);

function roleView(role: {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  permissions: { permissionKey: string }[];
}): RoleDefinition {
  return { ...role, permissions: role.permissions.map(({ permissionKey }) => permissionKey) };
}

export async function createServer(
  user: User,
  name: string,
): Promise<{ server: Server; channel: Channel }> {
  const result = await db.$transaction(async (tx) => {
    const server = await tx.server.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
        channels: { create: { name: "geral" } },
      },
      include: { channels: true },
    });
    const everyone = await tx.serverRole.create({
      data: { serverId: server.id, name: "Membro", isDefault: true, position: 0 },
    });
    await tx.serverMemberRole.create({ data: { serverId: server.id, userId: user.id, roleId: everyone.id } });
    return server;
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
      roleLinks: { include: { role: { select: { id: true, name: true, color: true, position: true } } } },
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
      roles: row.roleLinks.map(({ role }) => role),
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
  return hasServerPermission(userId, serverId, "channels.create") || hasServerPermission(userId, serverId, "invites.create");
}

export async function hasServerPermission(
  userId: string,
  serverId: string,
  permission: Permission,
): Promise<boolean> {
  const server = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (server?.ownerId === userId) return true;
  const member = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roleLinks: { include: { role: { include: roleInclude } } } },
  });
  if (!member) return false;
  const rolePermissions = member.roleLinks.flatMap(({ role }) => role.permissions.map(({ permissionKey }) => permissionKey));
  return rolePermissions.includes(permission) || baselineMemberPermissions.has(permission) || can(member.role as ServerRole, permission, member.permissions);
}

export async function listPermissions() {
  return db.permissionDefinition.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
}

export async function listRoles(userId: string, serverId: string): Promise<RoleDefinition[] | null> {
  if (!(await isServerMember(userId, serverId))) return null;
  const roles = await db.serverRole.findMany({ where: { serverId }, include: roleInclude, orderBy: { position: "desc" } });
  return roles.map(roleView);
}

export async function createRole(actorId: string, serverId: string, name: string, color: string, permissionKeys: string[]) {
  if (!(await hasServerPermission(actorId, serverId, "roles.create"))) return null;
  const count = await db.serverRole.count({ where: { serverId } });
  const role = await db.serverRole.create({
    data: {
      serverId, name, color, position: count,
      permissions: { create: permissionKeys.filter((key) => knownPermissions.includes(key as never)).map((permissionKey) => ({ permissionKey })) },
    }, include: roleInclude,
  });
  return roleView(role);
}

async function canManageRole(actorId: string, serverId: string, roleId: string, permission: Permission) {
  if (!(await hasServerPermission(actorId, serverId, permission))) return false;
  const server = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (server?.ownerId === actorId) return true;
  const [target, actorRoles] = await Promise.all([
    db.serverRole.findFirst({ where: { id: roleId, serverId }, select: { position: true } }),
    db.serverMemberRole.findMany({ where: { serverId, userId: actorId }, include: { role: { select: { position: true } } } }),
  ]);
  return Boolean(target && actorRoles.some(({ role }) => role.position > target.position));
}

export async function updateRole(actorId: string, serverId: string, roleId: string, input: { name?: string; color?: string; permissionKeys?: string[] }) {
  if (!(await canManageRole(actorId, serverId, roleId, "roles.manage"))) return null;
  const role = await db.serverRole.findFirst({ where: { id: roleId, serverId } });
  if (!role || role.isDefault) return null;
  const updated = await db.$transaction(async (tx) => {
    if (input.permissionKeys) await tx.serverRolePermission.deleteMany({ where: { roleId } });
    return tx.serverRole.update({ where: { id: roleId }, data: { name: input.name, color: input.color, permissions: input.permissionKeys ? { create: input.permissionKeys.filter((key) => knownPermissions.includes(key as never)).map((permissionKey) => ({ permissionKey })) } : undefined }, include: roleInclude });
  });
  return roleView(updated);
}

export async function deleteRole(actorId: string, serverId: string, roleId: string) {
  if (!(await canManageRole(actorId, serverId, roleId, "roles.manage"))) return false;
  const result = await db.serverRole.deleteMany({ where: { id: roleId, serverId, isDefault: false } });
  return result.count > 0;
}

export async function assignRole(actorId: string, serverId: string, memberId: string, roleId: string, assign: boolean) {
  if (!(await hasServerPermission(actorId, serverId, "members.manage_roles"))) return false;
  const role = await db.serverRole.findFirst({ where: { id: roleId, serverId } });
  if (!role || !(await isServerMember(memberId, serverId))) return false;
  if (!(await canManageRole(actorId, serverId, roleId, "members.manage_roles"))) return false;
  if (assign) await db.serverMemberRole.upsert({ where: { serverId_userId_roleId: { serverId, userId: memberId, roleId } }, create: { serverId, userId: memberId, roleId }, update: {} });
  else if (!role.isDefault) await db.serverMemberRole.deleteMany({ where: { serverId, userId: memberId, roleId } });
  return true;
}

export async function memberRoles(userId: string, serverId: string) {
  const rows = await db.serverMemberRole.findMany({ where: { serverId, userId }, include: { role: true }, orderBy: { role: { position: "desc" } } });
  return rows.map(({ role }) => ({ id: role.id, name: role.name, color: role.color, position: role.position }));
}

export async function updateServer(actorId: string, serverId: string, input: { name?: string; iconUrl?: string | null }) {
  const server = await db.server.findFirst({ where: { id: serverId, ownerId: actorId } });
  if (!server) return null;
  if (input.iconUrl !== undefined && input.iconUrl !== null && !/^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(input.iconUrl)) return null;
  const updated = await db.server.update({ where: { id: serverId }, data: input });
  return serverView(updated);
}

export async function banMember(actorId: string, serverId: string, memberId: string, reason?: string) {
  const server = await db.server.findFirst({ where: { id: serverId, ownerId: actorId } });
  if (!server || memberId === server.ownerId || !(await isServerMember(memberId, serverId))) return false;
  await db.$transaction([
    db.serverBan.upsert({ where: { serverId_userId: { serverId, userId: memberId } }, create: { serverId, userId: memberId, createdBy: actorId, reason }, update: { createdBy: actorId, reason } }),
    db.serverMember.delete({ where: { serverId_userId: { serverId, userId: memberId } } }),
  ]);
  return true;
}

export async function listBans(actorId: string, serverId: string) {
  const server = await db.server.findFirst({ where: { id: serverId, ownerId: actorId } });
  if (!server) return null;
  return db.serverBan.findMany({ where: { serverId }, include: { user: { select: userSelect } }, orderBy: { createdAt: "desc" } });
}

export async function unbanMember(actorId: string, serverId: string, memberId: string) {
  const server = await db.server.findFirst({ where: { id: serverId, ownerId: actorId } });
  if (!server) return false;
  const result = await db.serverBan.deleteMany({ where: { serverId, userId: memberId } });
  return result.count > 0;
}

export async function isBanned(serverId: string, userId: string) {
  return Boolean(await db.serverBan.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { userId: true } }));
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
  const member = await db.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { role: true } });
  if (!member || !(await hasServerPermission(userId, serverId, "invites.create"))) return null;
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
  const channel = await db.channel.findFirst({
    where: {
      server: { members: { some: { userId } } },
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
