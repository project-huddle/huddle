import { db, userSelect } from "../../../shared/infrastructure/database/mappers";
import type { ServerMember, ServerRole } from "@/features/servers/types/server";
import { can, type Permission } from "@/core/moderation/permissions";
import { serverForUser } from "./server-repository";
const serverMemberUserSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;
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
export async function serverMembers(
  userId: string,
  serverId: string,
): Promise<ServerMember[] | null> {
  if (!(await hasServerPermission(userId, serverId, "members.view"))) return null;
  const rows = await db.serverMember.findMany({
    where: { serverId },
    include: {
      user: { select: serverMemberUserSelect },
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
      id: row.user.id,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
      role: row.role as ServerRole,
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
  return rolePermissions.includes(permission) || can(member.role as ServerRole, permission, member.permissions);
}
export async function banMember(actorId: string, serverId: string, memberId: string, reason?: string) {
  const server = await db.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (!server || !(await hasServerPermission(actorId, serverId, "members.ban"))) return false;
  if (!server || memberId === server.ownerId || !(await isServerMember(memberId, serverId))) return false;
  await db.$transaction([
    db.serverBan.upsert({ where: { serverId_userId: { serverId, userId: memberId } }, create: { serverId, userId: memberId, createdBy: actorId, reason }, update: { createdBy: actorId, reason } }),
    db.serverMember.delete({ where: { serverId_userId: { serverId, userId: memberId } } }),
  ]);
  return true;
}
export async function listBans(actorId: string, serverId: string) {
  if (!(await hasServerPermission(actorId, serverId, "members.ban"))) return null;
  return db.serverBan.findMany({ where: { serverId }, include: { user: { select: userSelect } }, orderBy: { createdAt: "desc" } });
}
export async function unbanMember(actorId: string, serverId: string, memberId: string) {
  if (!(await hasServerPermission(actorId, serverId, "members.ban"))) return false;
  const result = await db.serverBan.deleteMany({ where: { serverId, userId: memberId } });
  return result.count > 0;
}
export async function isBanned(serverId: string, userId: string) {
  return Boolean(await db.serverBan.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { userId: true } }));
}
export async function setMemberRole(
  actorId: string,
  serverId: string,
  memberId: string,
  role: "moderator" | "member",
): Promise<"ok" | "forbidden" | "missing"> {
  const server = await serverForUser(actorId, serverId);
  if (!server) return "missing";
  if (!(await hasServerPermission(actorId, serverId, "members.manage_roles"))) return "forbidden";
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
  if (!server) return "missing";
  if (!(await hasServerPermission(actorId, serverId, "members.kick"))) return "forbidden";
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
