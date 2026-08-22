import { Elysia } from "elysia";
import { error, json } from "@/http";
import {
  removeMember,
  serverMembers,
  setMemberRole,
} from "@/infra/database/server-repository";
import { revokeUnauthorizedSocketAccess } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { memberRoleBody, serverIdParams, serverMemberParams } from "../schemas";

export const serverMemberRoutes = new Elysia({ name: "server-member-routes" })
  .use(authenticatedRoutes("authenticated-server-member-routes"))
  .get(
    "/servers/:serverId/members",
    async ({ currentUser, params }) => {
      const members = await serverMembers(currentUser.id, params.serverId);
      if (!members)
        return error(403, "FORBIDDEN", "You are not a member of this server.");
      return json({ members });
    },
    { params: serverIdParams },
  )
  .patch(
    "/servers/:serverId/members/:memberId",
    async ({ currentUser, params, body }) => {
      if (body.role !== "moderator" && body.role !== "member")
        return error(400, "INVALID_ROLE", "Role must be moderator or member.");
      const result = await setMemberRole(
        currentUser.id,
        params.serverId,
        params.memberId,
        body.role,
      );
      if (result === "ok") return new Response(null, { status: 204 });
      if (result === "forbidden")
        return error(403, "FORBIDDEN", "Only the owner can change roles.");
      return error(404, "NOT_FOUND", "Member not found.");
    },
    { params: serverMemberParams, body: memberRoleBody },
  )
  .delete(
    "/servers/:serverId/members/:memberId",
    async ({ currentUser, params }) => {
      const result = await removeMember(
        currentUser.id,
        params.serverId,
        params.memberId,
      );
      if (result === "forbidden")
        return error(403, "FORBIDDEN", "Only the owner can remove members.");
      if (result === "missing")
        return error(404, "NOT_FOUND", "Member not found.");
      await revokeUnauthorizedSocketAccess(params.memberId);
      return new Response(null, { status: 204 });
    },
    { params: serverMemberParams },
  );
