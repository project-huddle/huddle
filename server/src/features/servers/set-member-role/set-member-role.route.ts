import { Elysia } from "elysia";
import { error } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import {
  memberRoleBody,
  serverMemberParams,
} from "../../../interfaces/http/schemas";
import { setMemberRole } from "./set-member-role";
import type { SetMemberRoleRepository } from "./set-member-role.port";

export function setMemberRoleRoute(repository: SetMemberRoleRepository) {
  return new Elysia({ name: "set-member-role-route" })
    .use(authenticatedRoutes("authenticated-set-member-role"))
    .patch(
      "/servers/:serverId/members/:memberId",
      async ({ currentUser, params, body }) => {
        const result = await setMemberRole(
          repository,
          currentUser.id,
          params.serverId,
          params.memberId,
          body.role,
        );
        if (result.type === "success")
          return new Response(null, { status: 204 });
        if (result.type === "invalid-role")
          return error(
            400,
            "INVALID_ROLE",
            "Role must be moderator or member.",
          );
        if (result.type === "forbidden")
          return error(403, "FORBIDDEN", "Only the owner can change roles.");
        return error(404, "NOT_FOUND", "Member not found.");
      },
      { params: serverMemberParams, body: memberRoleBody },
    );
}
