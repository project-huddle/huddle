import type { RemoveMemberRepository } from "../../features/servers/remove-member/remove-member.port";
import { db } from "./mappers";

export function createRemoveMemberRepository(): RemoveMemberRepository {
  return {
    async removeMember(actorId, serverId, memberId) {
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
      await db.serverMember.delete({
        where: { serverId_userId: { serverId, userId: memberId } },
      });
      return "ok";
    },
  };
}
