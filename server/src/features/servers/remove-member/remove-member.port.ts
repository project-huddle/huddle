export type RemoveMemberRepository = {
  removeMember(
    actorId: string,
    serverId: string,
    memberId: string,
  ): Promise<"ok" | "forbidden" | "missing">;
};
