import { channelView, db, serverView } from "./mappers";
import type {
  CreateServerRepository,
  CreatedServer,
} from "../../features/servers/create-server/create-server.port";

export function createCreateServerRepository(): CreateServerRepository {
  return {
    async createServer(ownerId, name): Promise<CreatedServer> {
      const result = await db.server.create({
        data: {
          name,
          ownerId,
          members: { create: { userId: ownerId, role: "owner" } },
          channels: { create: { name: "geral" } },
        },
        include: { channels: true },
      });
      return {
        server: serverView(result),
        channel: channelView(result.channels[0]!),
      };
    },
  };
}
