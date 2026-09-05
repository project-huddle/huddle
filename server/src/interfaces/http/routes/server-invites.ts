import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import { db } from "@/infra/database/client";
import { createInvite, leaveServer } from "@/infra/database/server-repository";
import { revokeUnauthorizedSocketAccess } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import {
  createInviteBody,
  inviteCodeParams,
  serverIdParams,
} from "../schemas";

export const serverInviteRoutes = new Elysia({ name: "server-invite-routes" })
  .get(
    "/invites/:code",
    async ({ params }) => {
      const invite = await db.invite.findUnique({
        where: { code: params.code },
        select: {
          code: true,
          expiresAt: true,
          server: { select: { id: true, name: true } },
        },
      });
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
          "You cannot create invites for this server.",
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
      return new Response(null, { status: 204 });
    },
    { params: serverIdParams },
  );
