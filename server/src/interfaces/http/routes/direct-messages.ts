import { Elysia, t } from "elysia";
import {
  directMessageHistory,
  sendDirectMessage,
} from "@/app/direct-message-service";
import { error, json } from "@/interfaces/http/responses";
import { notifyUser } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { resourceId } from "../schemas";

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
const directMessageQuery = t.Object({ userId: resourceId });
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
      const messages = await directMessageHistory(currentUser.id, query.userId);
      if (!messages) return notFriends();
      return json({ messages });
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
