import type { ListedServer } from "../list-servers/list-servers.port";

export type GetServerRepository = {
  getServer(userId: string, serverId: string): Promise<ListedServer | null>;
};
