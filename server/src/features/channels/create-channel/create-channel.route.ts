import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import {
  createChannelBody,
  serverIdParams,
} from "../../../interfaces/http/schemas";
import type { CreateChannelHandler } from "./create-channel";

export function createChannelRoute(createChannel: CreateChannelHandler) {
  return new Elysia({ name: "create-channel-route" })
    .use(authenticatedRoutes("authenticated-create-channel"))
    .post(
      "/servers/:serverId/channels",
      async ({ currentUser, params, body }) => {
        const result = await createChannel({
          userId: currentUser.id,
          serverId: params.serverId,
          name: body.name,
        });
        if (result.type === "invalid-name")
          return error(
            400,
            "INVALID_INPUT",
            "Channel names may contain 2-32 letters, numbers, hyphens or underscores.",
          );
        if (result.type === "forbidden")
          return error(
            403,
            "FORBIDDEN",
            "You are not a member of this server.",
          );
        return json({ channel: result.channel }, 201);
      },
      { params: serverIdParams, body: createChannelBody },
    );
}
