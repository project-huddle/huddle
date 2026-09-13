import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  createServer,
  deleteServer,
  listServers,
  serverForUser,
  transferServerOwnership,
  updateServer,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";
import { createServerBody, serverIdParams, transferOwnershipBody } from "../schemas";
import { t } from "elysia";
import { notifyServerDataChanged, notifyUser } from "@/interfaces/realtime/realtime-gateway";

const updateServerBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 40 })),
  iconUrl: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
});

export const serverRoutes = new Elysia({ name: "server-routes" })
  .use(authenticatedRoutes("authenticated-server-routes"))
  .get("/servers", async ({ currentUser }) => {
    const servers = await listServers(currentUser.id);
    return json({ servers });
  })
  .post(
    "/servers",
    async ({ currentUser, body }) => {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 40)
        return error(
          400,
          "INVALID_INPUT",
          "Server names must have 2-40 characters.",
        );
      return json(await createServer(currentUser, name), 201);
    },
    { body: createServerBody },
  )
  .get(
    "/servers/:serverId",
    async ({ currentUser, params }) => {
      const server = await serverForUser(currentUser.id, params.serverId);
      if (!server)
        return error(403, "FORBIDDEN", "Você não pertence a este servidor.");
      return json({ server });
    },
    { params: serverIdParams },
  )
  .patch(
    "/servers/:serverId",
    async ({ currentUser, params, body }) => {
      if (body.name !== undefined && (body.name.trim().length < 2 || body.name.trim().length > 40))
        return error(400, "INVALID_INPUT", "O nome deve ter entre 2 e 40 caracteres.");
      const server = await updateServer(currentUser.id, params.serverId, {
        name: body.name?.trim(),
        iconUrl: body.iconUrl,
      });
      if (!server) return error(403, "FORBIDDEN", "Somente o proprietário pode editar o servidor.");
      await notifyServerDataChanged(params.serverId, ["servers"]);
      return json({ server });
    },
    { params: serverIdParams, body: updateServerBody },
  )
  .delete(
    "/servers/:serverId",
    async ({ currentUser, params }) => {
      const server = await serverForUser(currentUser.id, params.serverId);
      if (!server || server.ownerId !== currentUser.id)
        return error(403, "FORBIDDEN", "Somente o proprietário pode excluir o servidor.");
      // The member rows disappear with the cascade, so notify while they still exist.
      await notifyServerDataChanged(params.serverId, ["servers"]);
      if (!(await deleteServer(currentUser.id, params.serverId)))
        return error(403, "FORBIDDEN", "Somente o proprietário pode excluir o servidor.");
      notifyUser(currentUser.id, { type: "server_data_changed", serverId: params.serverId, resources: ["servers"] });
      return new Response(null, { status: 204 });
    },
    { params: serverIdParams },
  )
  .post(
    "/servers/:serverId/transfer-ownership",
    async ({ currentUser, params, body }) => {
      const result = await transferServerOwnership(
        currentUser.id,
        params.serverId,
        body.memberId,
      );
      if (result === "transferred") {
        await notifyServerDataChanged(params.serverId, ["servers", "members"]);
        return new Response(null, { status: 204 });
      }
      if (result === "target-not-member")
        return error(404, "MEMBER_NOT_FOUND", "O novo proprietário precisa ser membro do servidor.");
      if (result === "same-owner")
        return error(400, "INVALID_TARGET", "O novo proprietário precisa ser outro membro.");
      return error(403, "FORBIDDEN", "Somente o proprietário pode transferir a propriedade.");
    },
    { params: serverIdParams, body: transferOwnershipBody },
  );
