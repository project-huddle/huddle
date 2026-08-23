export type SetMemberRoleRepository = {
  setMemberRole(
    actorId: string,
    serverId: string,
    memberId: string,
    role: "moderator" | "member",
  ): Promise<"ok" | "forbidden" | "missing">;
};
