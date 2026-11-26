import { db } from "../../../shared/infrastructure/database/client";
import { permissions as knownPermissions, type Permission } from "@/core/moderation/permissions";
import { hasServerPermission, isServerMember } from "./server-member-repository";
const roleInclude = { permissions: { select: { permissionKey: true } } } as const;
function roleView(role: {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  permissions: { permissionKey: string }[];
}): RoleDefinition {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    isDefault: role.isDefault,
    permissions: role.permissions.map(({ permissionKey }) => permissionKey),
  };
}
export type RoleDefinition = {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  permissions: string[];
};
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
  if (!role) return null;
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
