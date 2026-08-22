import { Elysia } from "elysia";
import { error, json } from "@/http";
import {
  createInvite,
  leaveServer,
} from "@/infra/database/server-repository";
import { revokeUnauthorizedSocketAccess } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { serverIdParams } from "../schemas";

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
