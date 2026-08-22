import { Invite } from "../../../domain/servers/invite";
import { Server } from "../../../domain/servers/server";
import type { JoinServerRepository } from "./join-server.port";

export type JoinServerCommand = {
  userId: string;
  code: string;
  now?: Date;
};

export type JoinServerResult =
  | {
      type: "success";
      server: {
        id: string;
        name: string;
        ownerId: string;
        createdAt: string;
      };
    }
  | { type: "invalid-code" }
  | { type: "invite-not-found" };

export type JoinServerDependencies = {
  repository: JoinServerRepository;
  now?: () => Date;
};

export type JoinServerHandler = (
  command: JoinServerCommand,
) => Promise<JoinServerResult>;

function normalizeCode(rawCode: string): string | null {
  const code = rawCode.trim().toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(code)) return null;
  return code;
}

export function createJoinServer({
  repository,
  now = () => new Date(),
}: JoinServerDependencies): JoinServerHandler {
  return async function joinServer(
    command: JoinServerCommand,
  ): Promise<JoinServerResult> {
    const code = normalizeCode(command.code);
    if (!code) return { type: "invalid-code" };

    const inviteSnapshot = await repository.findInvite(code);
    if (!inviteSnapshot) return { type: "invite-not-found" };

    const invite = Invite.restore(inviteSnapshot);
    const currentTime = command.now ?? now();
    if (!invite.isActiveAt(currentTime)) return { type: "invite-not-found" };

    const serverSnapshot = await repository.findServer(invite.serverId);
    if (!serverSnapshot) return { type: "invite-not-found" };

    const server = Server.restore(serverSnapshot);
    const decision = server.join(command.userId);
    if (decision.type === "joined") {
      await repository.addMember(serverSnapshot.id, command.userId);
    }

    return { type: "success", server: server.view() };
  };
}
