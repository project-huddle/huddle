import { Prisma, PrismaClient } from "@prisma/client";
import type { InviteSnapshot } from "@/domain/servers/invite";
import type { ServerSnapshot } from "@/domain/servers/server";
import type { JoinServerRepository } from "@/features/servers/join-server/join-server.port";
import { db as defaultDatabase, serverView } from "./mappers";

export function createJoinServerRepository(
  database: PrismaClient = defaultDatabase,
): JoinServerRepository {
  return {
    async findInvite(code): Promise<InviteSnapshot | null> {
      const invite = await database.invite.findFirst({
        where: { code },
        select: { code: true, serverId: true, expiresAt: true },
      });
      return invite;
    },

    async findServer(serverId): Promise<ServerSnapshot | null> {
      const server = await database.server.findUnique({
        where: { id: serverId },
        include: { members: { select: { userId: true } } },
      });
      if (!server) return null;

      const view = serverView(server);
      return {
        ...view,
        memberIds: server.members.map((member) => member.userId),
      };
    },

    async addMember(serverId, userId) {
      try {
        await database.serverMember.create({ data: { serverId, userId } });
        return "joined";
      } catch (cause) {
        if (
          cause instanceof Prisma.PrismaClientKnownRequestError &&
          cause.code === "P2002"
        )
          return "already-member";
        throw cause;
      }
    },

    async isBanned(serverId, userId) {
      return Boolean(await database.serverBan.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { userId: true } }));
    },
  };
}
