import { Elysia, t } from "elysia";
import type { JoinServerHandler } from "@/features/servers/join-server/join-server";
import { joinServerRoute } from "@/features/servers/join-server/join-server.route";
import { config } from "@/bootstrap/config";
import {
  hasValidWebSocketTicket,
  realtimeWebSocket,
} from "../realtime/realtime-gateway";
import { errorHandling } from "./plugins/errors";
import { security } from "./plugins/security";
import { accountSecurityRoutes } from "./routes/account-security";
import { accountRoutes } from "./routes/account";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { directMessageRoutes } from "./routes/direct-messages";
import { friendRoutes } from "./routes/friends";
import { gifRoutes } from "./routes/gifs";
import { messageRoutes } from "./routes/messages";
import { publicRoutes } from "./routes/public";
import { reportRoutes } from "./routes/reports";
import { serverInviteRoutes } from "./routes/server-invites";
import { serverMemberRoutes } from "./routes/server-members";
import { serverRoutes } from "./routes/servers";
import { serverRoleRoutes } from "./routes/server-roles";
import { uploadRoutes } from "./routes/uploads";

export function createHttpApplication(dependencies: {
  joinServer: JoinServerHandler;
}) {
  return new Elysia({ name: "huddle-http" })
    .use(errorHandling)
    .use(security())
    .options("/*", () => new Response(null, { status: 204 }))
    .use(publicRoutes)
    .use(authRoutes)
    .use(accountRoutes)
    .use(accountSecurityRoutes)
    .use(serverRoutes)
    .use(serverRoleRoutes)
    .use(serverMemberRoutes)
    .use(serverInviteRoutes)
    .use(joinServerRoute(dependencies.joinServer))
    .use(channelRoutes)
    .use(uploadRoutes)
    .use(gifRoutes)
    .use(messageRoutes)
    .use(friendRoutes)
    .use(directMessageRoutes)
    .use(reportRoutes)
    .ws("/ws", {
      query: t.Object({ ticket: t.Optional(t.String({ minLength: 1 })) }),
      beforeHandle({ request, query, status }) {
        const origin = request.headers.get("origin");
        if (origin && !config.corsOrigins.has(origin))
          return status(403, {
            code: "ORIGIN_NOT_ALLOWED",
            message: "WebSocket origin is not allowed.",
          });
        if (!hasValidWebSocketTicket(query.ticket))
          return status(401, {
            code: "UNAUTHORIZED",
            message: "A valid one-time WebSocket ticket is required.",
          });
      },
      parse(_ws, message) {
        if (typeof message === "string") return message;
        if (message instanceof ArrayBuffer)
          return new TextDecoder().decode(message);
        if (ArrayBuffer.isView(message))
          return new TextDecoder().decode(
            new Uint8Array(
              message.buffer,
              message.byteOffset,
              message.byteLength,
            ),
          );
        return JSON.stringify(message);
      },
      ...realtimeWebSocket,
    });
}
