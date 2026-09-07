import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  createServer,
  listServers,
  serverForUser,
  updateServer,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";
import { createServerBody, serverIdParams } from "../schemas";
import { t } from "elysia";

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
        return error(403, "FORBIDDEN", "You are not a member of this server.");
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
      return json({ server });
    },
    { params: serverIdParams, body: updateServerBody },
  );
