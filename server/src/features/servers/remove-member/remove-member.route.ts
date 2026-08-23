import { Elysia } from "elysia";
import { error } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { serverMemberParams } from "../../../interfaces/http/schemas";
import { removeMember } from "./remove-member";
import type { RemoveMemberRepository } from "./remove-member.port";

export function removeMemberRoute(
  repository: RemoveMemberRepository,
  revokeAccess: (userId: string) => Promise<void>,
) {
  return new Elysia({ name: "remove-member-route" })
    .use(authenticatedRoutes("authenticated-remove-member"))
    .delete(
      "/servers/:serverId/members/:memberId",
      async ({ currentUser, params }) => {
        const result = await removeMember(
          repository,
          currentUser.id,
          params.serverId,
          params.memberId,
          revokeAccess,
        );
        if (result.type === "success")
          return new Response(null, { status: 204 });
        if (result.type === "forbidden")
          return error(403, "FORBIDDEN", "Only the owner can remove members.");
        return error(404, "NOT_FOUND", "Member not found.");
      },
      { params: serverMemberParams },
    );
}
