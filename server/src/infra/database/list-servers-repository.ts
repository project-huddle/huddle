import type { ListServersRepository } from "../../features/servers/list-servers/list-servers.port";
import { db, serverView } from "./mappers";

export function createListServersRepository(): ListServersRepository {
  return {
    async listServers(userId) {
      const servers = await db.server.findMany({
        where: { members: { some: { userId } } },
        orderBy: { createdAt: "asc" },
      });
      return servers.map(serverView);
    },
  };
}
