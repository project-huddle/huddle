import { db } from "../../../shared/infrastructure/database/client";
export async function membersForMentionParsing(serverId: string) {
  return db.serverMember.findMany({
    where: { serverId },
    select: { userId: true, user: { select: { displayName: true } } },
  });
}
export async function serverIdsForUser(userId: string): Promise<string[]> {
  const servers = await db.server.findMany({
    where: { members: { some: { userId } } },
    select: { id: true },
  });
  return servers.map(({ id }) => id);
}
export async function onlineMemberIds(
  serverId: string,
  userIds: string[],
): Promise<string[]> {
  const members = await db.serverMember.findMany({
    where: { serverId, userId: { in: userIds } },
    select: { userId: true },
  });
  return members.map(({ userId }) => userId);
}
export async function serverMemberIds(serverId: string): Promise<string[]> {
  const members = await db.serverMember.findMany({
    where: { serverId },
    select: { userId: true },
  });
  return members.map(({ userId }) => userId);
}
