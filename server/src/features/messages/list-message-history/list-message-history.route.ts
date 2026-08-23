import { Elysia, t } from "elysia";
import { config } from "../../../config";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { listMessageHistory } from "./list-message-history";
import type { ChannelAccess } from "../../channels/channel-access.port";
import type { MessageHistoryRepository } from "./list-message-history.port";

const messageHistoryQuery = t.Object({
  channelId: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  before: t.Optional(t.String()),
});

export function listMessageHistoryRoute(
  repository: MessageHistoryRepository,
  channelAccess: ChannelAccess,
) {
  return new Elysia({ name: "list-message-history-route" })
    .use(authenticatedRoutes("authenticated-list-message-history"))
    .get(
      "/messages",
      async ({ currentUser, query }) => {
        const result = await listMessageHistory(
          repository,
          channelAccess,
          currentUser.id,
          query.channelId,
          query.limit,
          query.before,
          config.maxHistoryLimit,
        );
        if (result.type === "forbidden")
          return error(403, "FORBIDDEN", "You cannot access this channel.");
        if (result.type === "invalid-cursor")
          return error(400, "INVALID_CURSOR", "before must be an ISO date.");
        return json({ messages: result.messages });
      },
      { query: messageHistoryQuery },
    );
}
