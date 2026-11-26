import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  createInvite,
  findInviteByCode,
  leaveServer,
} from "@/features/servers/infrastructure/server-invite-repository";
import { notifyServerDataChanged, notifyUser, revokeUnauthorizedSocketAccess } from "@/features/realtime/adapters/realtime-gateway";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import {
  createInviteBody,
  inviteCodeParams,
  serverIdParams,
} from "../../../interfaces/http/schemas";

export const serverInviteRoutes = new Elysia({ name: "server-invite-routes" })
  .get(
    "/invites/:code",
    async ({ params }) => {
      const invite = await findInviteByCode(params.code);
      if (!invite || invite.expiresAt <= new Date())
        return error(404, "INVITE_NOT_FOUND", "This invite is invalid or expired.");
      return json({
        invite: {
          code: invite.code,
          serverId: invite.server.id,
          serverName: invite.server.name,
          expiresAt: invite.expiresAt.toISOString(),
        },
      });
    },
    { params: inviteCodeParams },
  )
  .use(authenticatedRoutes("authenticated-server-invite-routes"))
  .post(
    "/servers/:serverId/invites",
    async ({ currentUser, params, body }) => {
      const invite = await createInvite(
        currentUser.id,
        params.serverId,
        body.durationHours,
      );
      if (!invite)
        return error(
          403,
          "FORBIDDEN",
          "Você não possui permissão para criar convites neste servidor.",
        );
      return json({ invite, url: `/invite/${invite.code}` }, 201);
    },
    { params: serverIdParams, body: createInviteBody },
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
      notifyUser(currentUser.id, { type: "server_data_changed", serverId: params.serverId, resources: ["servers"] });
      await notifyServerDataChanged(params.serverId, ["members"]);
      return new Response(null, { status: 204 });
    },
    { params: serverIdParams },
  );
