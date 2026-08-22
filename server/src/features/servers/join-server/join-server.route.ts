import { Elysia } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import { authenticatedRoutes } from "@/interfaces/http/plugins/auth";
import { joinInviteBody } from "@/interfaces/http/schemas";
import type { JoinServerHandler } from "./join-server";

export function joinServerRoute(joinServer: JoinServerHandler) {
  return new Elysia({ name: "join-server-route" })
    .use(authenticatedRoutes("authenticated-join-server"))
    .post(
      "/invites/join",
      async ({ currentUser, body }) => {
        const result = await joinServer({
          userId: currentUser.id,
          code: body.code,
        });

        if (result.type === "invalid-code")
          return error(400, "INVALID_INVITE", "Invalid invite code.");

        if (result.type === "invite-not-found")
          return error(
            404,
            "INVITE_NOT_FOUND",
            "This invite is invalid or expired.",
          );

        return json({ server: result.server }, 201);
      },
      { body: joinInviteBody },
    );
}
