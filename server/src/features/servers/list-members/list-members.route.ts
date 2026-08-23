import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverIdParams } from "../../../interfaces/http/schemas";
import { listMembers } from "./list-members";
import type { ListMembersRepository } from "./list-members.port";

export function listMembersRoute(repository: ListMembersRepository) {
  return new Elysia({ name: "list-members-route" })
    .use(authenticatedRoutes("authenticated-list-members"))
    .get(
      "/servers/:serverId/members",
      async ({ currentUser, params }) => {
        const result = await listMembers(
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
        return json({ members: result.members });
      },
      { params: serverIdParams },
    );
}
