import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverIdParams } from "../../../interfaces/http/schemas";
import { getServer } from "./get-server";
import type { GetServerRepository } from "./get-server.port";

export function getServerRoute(repository: GetServerRepository) {
  return new Elysia({ name: "get-server-route" })
    .use(authenticatedRoutes("authenticated-get-server"))
    .get(
      "/servers/:serverId",
      async ({ currentUser, params }) => {
        const result = await getServer(
          repository,
          currentUser.id,
          params.serverId,
        );
        if (result.type === "forbidden")
          return error(
            403,
            "FORBIDDEN",
            "You are not a member of this server.",
          );
        return json({ server: result.server });
      },
      { params: serverIdParams },
    );
}
