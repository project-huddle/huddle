import type { LeaveServerRepository } from "./leave-server.port";

export type LeaveServerResult =
  { type: "success" } | { type: "owner" } | { type: "missing" };

export async function leaveServer(
  repository: LeaveServerRepository,
  userId: string,
  serverId: string,
  revokeAccess: (userId: string) => Promise<void>,
): Promise<LeaveServerResult> {
  const result = await repository.leaveServer(userId, serverId);
  if (result === "left") {
    await revokeAccess(userId);
    return { type: "success" };
  }
  return { type: result };
}
