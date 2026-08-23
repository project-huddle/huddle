import { Elysia } from "elysia";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { createServerBody } from "../../../interfaces/http/schemas";
import type { CreateServerHandler } from "./create-server";

export function createServerRoute(createServer: CreateServerHandler) {
  return new Elysia({ name: "create-server-route" })
    .use(authenticatedRoutes("authenticated-create-server"))
    .post(
      "/servers",
      async ({ currentUser, body }) => {
        const result = await createServer({
          userId: currentUser.id,
          name: body.name,
        });
        if (result.type === "invalid-name")
          return error(
            400,
            "INVALID_INPUT",
            "Server names must have 2-40 characters.",
          );
        return json(result.created, 201);
      },
      { body: createServerBody },
    );
}
