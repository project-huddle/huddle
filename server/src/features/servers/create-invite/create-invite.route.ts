import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverIdParams } from "../../../interfaces/http/schemas";
import { createInvite } from "./create-invite";
import type { CreateInviteRepository } from "./create-invite.port";

export function createInviteRoute(repository: CreateInviteRepository) {
  return new Elysia({ name: "create-invite-route" })
    .use(authenticatedRoutes("authenticated-create-invite"))
    .post(
      "/servers/:serverId/invites",
      async ({ currentUser, params }) => {
        const result = await createInvite(
          repository,
          currentUser.id,
          params.serverId,
        );
        if (result.type === "forbidden")
          return error(
            403,
            "FORBIDDEN",
            "Only the owner or a moderator can create invites.",
          );
        return json(
          { invite: result.invite, url: `/invite/${result.invite.code}` },
          201,
        );
      },
      { params: serverIdParams },
    );
}
