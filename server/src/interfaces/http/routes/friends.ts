import { Elysia } from "elysia";
import { listFriendships } from "../../../features/social/list-friendships/list-friendships";
import type { ListFriendshipsRepository } from "../../../features/social/list-friendships/list-friendships.port";
import {
  acceptFriend,
  deleteFriendship,
} from "../../../features/social/friend-actions/friend-actions";
import type { FriendActionsRepository } from "../../../features/social/friend-actions/friend-actions.port";
import { requestFriend } from "../../../features/social/request-friend/request-friend";
import type { RequestFriendRepository } from "../../../features/social/request-friend/request-friend.port";
import { error, json } from "../../../http";
import { notifyUser } from "../../realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { emailBody, userIdParams } from "../schemas";

export function createFriendRoutes(
  repository: RequestFriendRepository,
  friendActionsRepository: FriendActionsRepository,
  listFriendshipsRepository: ListFriendshipsRepository,
) {
  return new Elysia({ name: "friend-routes" })
    .use(authenticatedRoutes("authenticated-friend-routes"))
    .get("/friends", async ({ currentUser }) => {
      return json({
        friendships: await listFriendships(
          listFriendshipsRepository,
          currentUser.id,
        ),
      });
    })
    .post(
      "/friends",
      async ({ currentUser, body }) => {
        const result = await requestFriend(repository, currentUser, body.email);
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
        notifyUser(result.user.id, {
          type: "friend_request",
          user: currentUser,
        });
        return json({ user: result.user, status: "pending" }, 201);
      },
      { body: emailBody },
    )
    .patch(
      "/friends/:userId",
      async ({ currentUser, params }) => {
        if (
          (await acceptFriend(
            friendActionsRepository,
            currentUser.id,
            params.userId,
          )) === "not-found"
        )
          return error(404, "REQUEST_NOT_FOUND", "Solicitação não encontrada.");
        return new Response(null, { status: 204 });
      },
      { params: userIdParams },
    )
    .delete(
      "/friends/:userId",
      async ({ currentUser, params }) => {
        await deleteFriendship(
          friendActionsRepository,
          currentUser.id,
          params.userId,
        );
        return new Response(null, { status: 204 });
      },
      { params: userIdParams },
    );
}
