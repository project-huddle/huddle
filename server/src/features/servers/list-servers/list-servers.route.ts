import { Elysia } from "elysia";
import { json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import type { ListServersHandler } from "./list-servers";

export function listServersRoute(listServers: ListServersHandler) {
  return new Elysia({ name: "list-servers-route" })
    .use(authenticatedRoutes("authenticated-list-servers"))
    .get("/servers", async ({ currentUser }) =>
      json({ servers: await listServers(currentUser.id) }),
    );
}
