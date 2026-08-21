import { Elysia } from "elysia";
import { error, json } from "../../../http";
import {
  createInvite,
  joinServer,
  leaveServer,
} from "../../../infra/database/server-repository";
import { revokeUnauthorizedSocketAccess } from "../../realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { joinInviteBody, serverIdParams } from "../schemas";

export const serverInviteRoutes = new Elysia({ name: "server-invite-routes" })
  .use(authenticatedRoutes("authenticated-server-invite-routes"))
  .post(
    "/servers/:serverId/invites",
    async ({ currentUser, params }) => {
      const invite = await createInvite(currentUser.id, params.serverId);
      if (!invite)
        return error(
          403,
          "FORBIDDEN",
          "Only the owner or a moderator can create invites.",
        );
      return json({ invite, url: `/invite/${invite.code}` }, 201);
    },
    { params: serverIdParams },
  )
  .post(
    "/invites/join",
    async ({ currentUser, body }) => {
      const code = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6,16}$/.test(code))
        return error(400, "INVALID_INVITE", "Invalid invite code.");
      const server = await joinServer(currentUser.id, code.toLowerCase());
      if (!server)
        return error(
          404,
          "INVITE_NOT_FOUND",
          "This invite is invalid or expired.",
        );
      return json({ server }, 201);
    },
    { body: joinInviteBody },
  )
  .post(
    "/servers/:serverId/leave",
    async ({ currentUser, params }) => {
      const result = await leaveServer(currentUser.id, params.serverId);
      if (result === "owner")
        return error(
          409,
          "OWNER_CANNOT_LEAVE",
          "The owner cannot leave their own server.",
        );
      if (result === "missing")
        return error(404, "NOT_FOUND", "Server not found.");
      await revokeUnauthorizedSocketAccess(currentUser.id);
      return new Response(null, { status: 204 });
    },
    { params: serverIdParams },
  );
