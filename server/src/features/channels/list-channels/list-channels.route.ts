import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverIdParams } from "../../../interfaces/http/schemas";
import type { ListChannelsHandler } from "./list-channels";

export function listChannelsRoute(listChannels: ListChannelsHandler) {
  return new Elysia({ name: "list-channels-route" })
    .use(authenticatedRoutes("authenticated-list-channels"))
    .get(
      "/servers/:serverId/channels",
      async ({ currentUser, params }) => {
        const result = await listChannels({
          userId: currentUser.id,
          serverId: params.serverId,
        });
        if (result.type === "forbidden")
          return error(
            403,
            "FORBIDDEN",
            "You are not a member of this server.",
          );
        return json({ channels: result.channels });
      },
      { params: serverIdParams },
    );
}
