import { Elysia, t } from "elysia";
import {
  directMessageHistory,
  sendDirectMessage,
} from "@/features/messages/application/direct-message-service";
import { error, json } from "@/interfaces/http/responses";
import { notifyUser } from "@/features/realtime/adapters/realtime-gateway";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { resourceId } from "../../../interfaces/http/schemas";

const directMessageBody = t.Object({
  recipientId: resourceId,
  content: t.String({ maxLength: 2000 }),
  media: t.Optional(
    t.Union([
      t.Null(),
      t.Object({
        url: t.String({ maxLength: 2000 }),
        type: t.Union([t.Literal("image"), t.Literal("gif")]),
        alt: t.String({ maxLength: 160 }),
      }),
    ]),
  ),
});
const directMessageQuery = t.Object({
  userId: resourceId,
  cursor: t.Optional(t.String({ maxLength: 1024 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
});
const notFriends = () =>
  error(
    403,
    "NOT_FRIENDS",
    "Mensagens privadas são permitidas apenas entre amigos.",
  );

export const directMessageRoutes = new Elysia({ name: "direct-message-routes" })
  .use(authenticatedRoutes("authenticated-direct-message-routes"))
  .get(
    "/direct-messages",
    async ({ currentUser, query }) => {
      const result = await directMessageHistory(
        currentUser.id,
        query.userId,
        query,
      );
      if (result.type === "not-friends") return notFriends();
      if (result.type === "invalid-cursor")
        return error(400, "INVALID_CURSOR", "Cursor de mensagens inválido.");
      return json({ messages: result.messages, nextCursor: result.nextCursor });
    },
    { query: directMessageQuery },
  )
  .post(
    "/direct-messages",
    async ({ currentUser, body }) => {
      const result = await sendDirectMessage(
        currentUser.id,
        body.recipientId,
        body.content,
        body.media,
      );
      if (result.type === "not-friends") return notFriends();
      if (result.type === "invalid-message")
        return error(400, "INVALID_MESSAGE", "Escreva uma mensagem válida.");
      notifyUser(body.recipientId, {
        type: "direct_message",
        message: result.message,
      });
      notifyUser(currentUser.id, {
        type: "direct_message",
        message: result.message,
      });
      return json({ message: result.message }, 201);
    },
    { body: directMessageBody },
  );
