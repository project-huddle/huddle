import { Elysia } from "elysia";
import { error, json } from "@/http";
import {
  createServer,
  listServers,
  serverForUser,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";
import { createServerBody, serverIdParams } from "../schemas";

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
  );
