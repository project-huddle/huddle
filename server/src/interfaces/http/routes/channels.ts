import { Elysia, t } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  createChannel,
  isServerMember,
  listChannels,
  updateChannelAccess,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";
import { createChannelBody, serverIdParams, resourceId } from "../schemas";
import {
  renameChannel,
  deleteChannel,
} from "@/infra/database/channel-management-repository";
import { revokeChannelSocketAccess } from "@/interfaces/realtime/realtime-gateway";

const channelParams = t.Object({ serverId: resourceId, channelId: resourceId });
const renameChannelBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 32, pattern: "^[a-z0-9_-]+$" }),
});
const channelAccessBody = t.Object({ roleIds: t.Array(resourceId) });

function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function isValidChannelName(name: string): boolean {
  return name.length >= 2 && name.length <= 32 && /^[a-z0-9-_]+$/.test(name);
}

export const channelRoutes = new Elysia({ name: "channel-routes" })
  .use(authenticatedRoutes("authenticated-channel-routes"))
  .get(
    "/servers/:serverId/channels",
    async ({ currentUser, params }) => {
      const isMember = await isServerMember(currentUser.id, params.serverId);
      if (!isMember)
        return error(403, "FORBIDDEN", "You are not a member of this server.");
      return json({
        channels: await listChannels(currentUser.id, params.serverId),
      });
    },
    { params: serverIdParams },
  )
  .post(
    "/servers/:serverId/channels",
    async ({ currentUser, params, body }) => {
      const name = normalizeChannelName(body.name);
      if (!isValidChannelName(name))
        return error(
          400,
          "INVALID_INPUT",
          "Channel names may contain 2-32 letters, numbers, hyphens or underscores.",
        );
      const channel = await createChannel(
        currentUser.id,
        params.serverId,
        name,
        body.type ?? "text",
      );
      if (!channel)
        return error(403, "FORBIDDEN", "You are not a member of this server.");
      return json({ channel }, 201);
    },
    { params: serverIdParams, body: createChannelBody },
  )
  .patch(
    "/servers/:serverId/channels/:channelId",
    async ({ currentUser, params, body }) => {
      const channel = await renameChannel(
        currentUser.id,
        params.serverId,
        params.channelId,
        body.name,
      );
      if (!channel)
        return error(
          403,
          "FORBIDDEN",
          "Canal indisponível ou sem permissão para editar.",
        );
      return json({ channel });
    },
    { params: channelParams, body: renameChannelBody },
  )
  .patch(
    "/servers/:serverId/channels/:channelId/access",
    async ({ currentUser, params, body }) => {
      if (!(await updateChannelAccess(currentUser.id, params.serverId, params.channelId, body.roleIds)))
        return error(403, "FORBIDDEN", "Você não pode alterar o acesso deste canal.");
      revokeChannelSocketAccess(params.channelId);
      return new Response(null, { status: 204 });
    },
    { params: channelParams, body: channelAccessBody },
  )
  .delete(
    "/servers/:serverId/channels/:channelId",
    async ({ currentUser, params }) => {
      const deleted = await deleteChannel(
        currentUser.id,
        params.serverId,
        params.channelId,
      );
      if (!deleted)
        return error(
          403,
          "FORBIDDEN",
          "Canal indisponível ou sem permissão para excluir.",
        );
      revokeChannelSocketAccess(params.channelId);
      return new Response(null, { status: 204 });
    },
    { params: channelParams },
  );
