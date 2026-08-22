import { Elysia, t } from "elysia";
import { config } from "@/bootstrap/config";
import { error, json } from "@/interfaces/http/responses";
import { messageHistory } from "@/infra/database/message-repository";
import {
  channelForUser,
  firstChannelForUser,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";

const messageHistoryQuery = t.Object({
  channelId: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  before: t.Optional(t.String()),
});

function historyLimit(value?: string): number {
  const parsed = Number(value ?? 50);
  if (!Number.isInteger(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), config.maxHistoryLimit);
}

export const messageRoutes = new Elysia({ name: "message-routes" })
  .use(authenticatedRoutes("authenticated-message-routes"))
  .get(
    "/messages",
    async ({ currentUser, query }) => {
      const fallbackChannel = await firstChannelForUser(currentUser.id);
      const channelId = query.channelId || fallbackChannel?.id || "";
      if (!(await channelForUser(currentUser.id, channelId)))
        return error(403, "FORBIDDEN", "You cannot access this channel.");
      if (query.before && Number.isNaN(Date.parse(query.before)))
        return error(400, "INVALID_CURSOR", "before must be an ISO date.");
      const messages = await messageHistory(
        channelId,
        historyLimit(query.limit),
        query.before,
      );
      return json({ messages });
    },
    { query: messageHistoryQuery },
  );
