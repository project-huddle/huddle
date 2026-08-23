import type { ListMembersRepository } from "../../features/servers/list-members/list-members.port";
import { db, userSelect, userView, type ServerRole } from "./mappers";

export function createListMembersRepository(): ListMembersRepository {
  return {
    async listMembers(userId, serverId) {
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId } },
        select: { userId: true },
      });
      if (!member) return null;

      const rows = await db.serverMember.findMany({
        where: { serverId },
        include: {
          user: { select: userSelect },
          server: { select: { ownerId: true } },
        },
      });
      const priority: Record<ServerRole, number> = {
        owner: 0,
        moderator: 1,
        member: 2,
      };
      return rows
        .map((row) => ({
          ...userView(row.user),
          joinedAt: row.createdAt.toISOString(),
          role: row.role as ServerRole,
          isOwner: row.userId === row.server.ownerId,
        }))
        .sort(
          (a, b) =>
            priority[a.role] - priority[b.role] ||
            a.displayName.localeCompare(b.displayName),
        );
    },
  };
}
