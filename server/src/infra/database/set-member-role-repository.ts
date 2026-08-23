import type { SetMemberRoleRepository } from "../../features/servers/set-member-role/set-member-role.port";
import { db, type ServerRole } from "./mappers";

export function createSetMemberRoleRepository(): SetMemberRoleRepository {
  return {
    async setMemberRole(actorId, serverId, memberId, role) {
      const server = await db.server.findFirst({
        where: { id: serverId, members: { some: { userId: actorId } } },
        select: { ownerId: true },
      });
      if (!server) return "missing";
      if (server.ownerId !== actorId) return "forbidden";
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: memberId } },
        select: { userId: true },
      });
      if (!member || memberId === server.ownerId) return "missing";
      await db.serverMember.update({
        where: { serverId_userId: { serverId, userId: memberId } },
        data: { role: role as ServerRole },
      });
      return "ok";
    },
  };
}
