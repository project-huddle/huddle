import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  removeMember,
  serverMembers,
  setMemberRole,
  banMember,
  listBans,
  unbanMember,
} from "@/infra/database/server-repository";
import { revokeUnauthorizedSocketAccess } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { memberRoleBody, serverIdParams, serverMemberParams } from "../schemas";
import { t } from "elysia";

const banBody = t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) });

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
  )
  .post(
    "/servers/:serverId/members/:memberId/ban",
    async ({ currentUser, params, body }) => {
      if (!(await banMember(currentUser.id, params.serverId, params.memberId, body.reason?.trim())))
        return error(403, "FORBIDDEN", "Somente o proprietário pode banir membros.");
      await revokeUnauthorizedSocketAccess(params.memberId);
      return new Response(null, { status: 204 });
    },
    { params: serverMemberParams, body: banBody },
  )
  .get(
    "/servers/:serverId/bans",
    async ({ currentUser, params }) => {
      const bans = await listBans(currentUser.id, params.serverId);
      if (!bans) return error(403, "FORBIDDEN", "Somente o proprietário pode ver banimentos.");
      return json({ bans });
    },
    { params: serverIdParams },
  )
  .delete(
    "/servers/:serverId/bans/:memberId",
    async ({ currentUser, params }) => {
      if (!(await unbanMember(currentUser.id, params.serverId, params.memberId)))
        return error(404, "NOT_FOUND", "Banimento não encontrado.");
      return new Response(null, { status: 204 });
    },
    { params: serverMemberParams },
  );
