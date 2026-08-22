import { Elysia } from "elysia";
import {
  acceptFriend,
  deleteFriendship,
  listFriendships,
  requestFriend,
} from "@/app/social-service";
import { error, json } from "@/interfaces/http/responses";
import { notifyUser } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { emailBody, userIdParams } from "../schemas";

export const friendRoutes = new Elysia({ name: "friend-routes" })
  .use(authenticatedRoutes("authenticated-friend-routes"))
  .get("/friends", async ({ currentUser }) => {
    return json({ friendships: await listFriendships(currentUser.id) });
  })
  .post(
    "/friends",
    async ({ currentUser, body }) => {
      const result = await requestFriend(currentUser, body.email);
      if (result.type === "invalid")
        return error(
          400,
          "INVALID_FRIEND",
          "Informe o e-mail de outra pessoa.",
        );
      if (result.type === "not-found")
        return error(404, "USER_NOT_FOUND", "Usuário não encontrado.");
      if (result.type === "exists")
        return error(
          409,
          "REQUEST_EXISTS",
          "Já existe uma solicitação entre estas contas.",
        );
      notifyUser(result.user.id, { type: "friend_request", user: currentUser });
      return json({ user: result.user, status: "pending" }, 201);
    },
    { body: emailBody },
  )
  .patch(
    "/friends/:userId",
    async ({ currentUser, params }) => {
      if (!(await acceptFriend(currentUser.id, params.userId)))
        return error(404, "REQUEST_NOT_FOUND", "Solicitação não encontrada.");
      return new Response(null, { status: 204 });
    },
    { params: userIdParams },
  )
  .delete(
    "/friends/:userId",
    async ({ currentUser, params }) => {
      await deleteFriendship(currentUser.id, params.userId);
      return new Response(null, { status: 204 });
    },
    { params: userIdParams },
  );
