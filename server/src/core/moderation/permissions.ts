export const permissions = [
  "server.view",
  "server.settings.manage",
  "channels.view",
  "channels.create",
  "channels.manage",
  "channels.delete",
  "channels.access.manage",
  "roles.create",
  "roles.manage",
  "members.view",
  "members.manage_roles",
  "members.kick",
  "members.ban",
  "invites.create",
  "messages.send",
  "members.manage",
  "messages.moderate",
  "reports.review",
  "voice.connect",
  "voice.speak",
  "voice.camera",
  "voice.screen_share",
  "voice.moderate_mute",
  "voice.moderate_camera",
  "voice.moderate_screen_share",
  "voice.disconnect",
] as const;

export type Permission = (typeof permissions)[number];
export type Role = "owner" | "moderator" | "member";

const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: permissions,
  moderator: [
    "channels.create",
    "channels.manage",
    "invites.create",
    "messages.moderate",
    "reports.review",
  ],
  member: ["invites.create"],
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
