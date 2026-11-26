export type Server = {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
};

export type Channel = {
  id: string;
  serverId: string;
  name: string;
  type: "text" | "voice";
  roleIds: string[];
};

export type ServerRole = "owner" | "moderator" | "member";

export type ServerMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: ServerRole;
  roles: { id: string; name: string; color: string; position: number }[];
};

export type ServerInvite = {
  code: string;
  serverId: string;
  expiresAt: string;
};
