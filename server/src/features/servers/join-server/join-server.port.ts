import type { InviteSnapshot } from "@/domain/servers/invite";
import type { ServerSnapshot } from "@/domain/servers/server";

export type JoinServerRepository = {
  findInvite(code: string): Promise<InviteSnapshot | null>;
  findServer(serverId: string): Promise<ServerSnapshot | null>;
  addMember(
    serverId: string,
    userId: string,
  ): Promise<"joined" | "already-member">;
};
