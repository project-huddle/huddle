import type { RemoveMemberRepository } from "./remove-member.port";

export type RemoveMemberResult =
  { type: "success" } | { type: "forbidden" } | { type: "missing" };

export async function removeMember(
  repository: RemoveMemberRepository,
  actorId: string,
  serverId: string,
  memberId: string,
  revokeAccess: (userId: string) => Promise<void>,
): Promise<RemoveMemberResult> {
  const result = await repository.removeMember(actorId, serverId, memberId);
  if (result !== "ok") return { type: result };
  await revokeAccess(memberId);
  return { type: "success" };
}
