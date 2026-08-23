import type { GetServerRepository } from "../../features/servers/get-server/get-server.port";
import { db, serverView } from "./mappers";

export function createGetServerRepository(): GetServerRepository {
  return {
    async getServer(userId, serverId) {
      const server = await db.server.findFirst({
        where: { id: serverId, members: { some: { userId } } },
      });
      return server ? serverView(server) : null;
    },
  };
}
