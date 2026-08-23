import type { LeaveServerRepository } from "../../features/servers/leave-server/leave-server.port";
import { db } from "./mappers";

export function createLeaveServerRepository(): LeaveServerRepository {
  return {
    async leaveServer(userId, serverId) {
      const server = await db.server.findFirst({
        where: { id: serverId, members: { some: { userId } } },
        select: { ownerId: true },
      });
      if (!server) return "missing";
      if (server.ownerId === userId) return "owner";
      await db.serverMember.delete({
        where: { serverId_userId: { serverId, userId } },
      });
      return "left";
    },
  };
}
