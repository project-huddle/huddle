import { Elysia } from "elysia";
import { error } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverIdParams } from "../../../interfaces/http/schemas";
import { leaveServer } from "./leave-server";
import type { LeaveServerRepository } from "./leave-server.port";

export function leaveServerRoute(
  repository: LeaveServerRepository,
  revokeAccess: (userId: string) => Promise<void>,
) {
  return new Elysia({ name: "leave-server-route" })
    .use(authenticatedRoutes("authenticated-leave-server"))
    .post(
      "/servers/:serverId/leave",
      async ({ currentUser, params }) => {
        const result = await leaveServer(
          repository,
          currentUser.id,
          params.serverId,
          revokeAccess,
        );
        if (result.type === "owner")
          return error(
            409,
            "OWNER_CANNOT_LEAVE",
            "The owner cannot leave their own server.",
          );
        if (result.type === "missing")
          return error(404, "NOT_FOUND", "Server not found.");
        return new Response(null, { status: 204 });
      },
      { params: serverIdParams },
    );
}
