import type { SetMemberRoleRepository } from "./set-member-role.port";

export type SetMemberRoleResult =
  | { type: "success" }
  | { type: "forbidden" }
  | { type: "missing" }
  | { type: "invalid-role" };

export async function setMemberRole(
  repository: SetMemberRoleRepository,
  actorId: string,
  serverId: string,
  memberId: string,
  role: string,
): Promise<SetMemberRoleResult> {
  if (role !== "moderator" && role !== "member")
    return { type: "invalid-role" };
  const result = await repository.setMemberRole(
    actorId,
    serverId,
    memberId,
    role,
  );
  return result === "ok" ? { type: "success" } : { type: result };
}
