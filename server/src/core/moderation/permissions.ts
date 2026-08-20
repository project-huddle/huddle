export const permissions = [
  "channels.create",
  "invites.create",
  "members.manage",
  "messages.moderate",
  "reports.review",
] as const;

export type Permission = (typeof permissions)[number];
export type Role = "owner" | "moderator" | "member";

const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: permissions,
  moderator: [
    "channels.create",
    "invites.create",
    "messages.moderate",
    "reports.review",
  ],
  member: [],
};

export function permissionsFor(
  role: Role,
  overrides: string[] = [],
): Set<Permission> {
  return new Set([
    ...rolePermissions[role],
    ...overrides.filter((item): item is Permission =>
      permissions.includes(item as Permission),
    ),
  ]);
}

export function can(
  role: Role,
  permission: Permission,
  overrides: string[] = [],
): boolean {
  return permissionsFor(role, overrides).has(permission);
}
