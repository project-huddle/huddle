import { mediaRoutes } from "../../features/media/http/media.route";
import { callIceConfigRoutes } from "../../features/calls/http/call-ice-config.route";
import { Elysia, t } from "elysia";
import type { JoinServerHandler } from "@/features/servers/join-server/join-server";
import { joinServerRoute } from "@/features/servers/join-server/join-server.route";
import { config } from "@/bootstrap/config";
import {
  hasValidWebSocketTicket,
  realtimeWebSocket,
} from "../../features/realtime/adapters/realtime-gateway";
import { errorHandling } from "./plugins/errors";
import { security } from "./plugins/security";
import { accountSecurityRoutes } from "../../features/account/http/account-security.route";
import { accountRoutes } from "../../features/account/http/account.route";
import { authRoutes } from "../../features/auth/http/auth.route";
import { channelRoutes } from "../../features/servers/http/channels.route";
import { directCallRoutes } from "../../features/calls/http/direct-calls.route";
import { directMessageRoutes } from "../../features/messages/http/direct-messages.route";
import { friendRoutes } from "../../features/social/http/friends.route";
import { gifRoutes } from "../../features/media/http/gifs.route";
import { messageRoutes } from "../../features/messages/http/messages.route";
import { publicRoutes } from "./public.route";
import { reportRoutes } from "../../features/moderation/http/reports.route";
import { serverInviteRoutes } from "../../features/servers/http/server-invites.route";
import { serverMemberRoutes } from "../../features/servers/http/server-members.route";
import { serverRoutes } from "../../features/servers/http/servers.route";
import { serverRoleRoutes } from "../../features/servers/http/server-roles.route";
import { uploadRoutes } from "../../features/media/http/uploads.route";

export function createHttpApplication(dependencies: {
  joinServer: JoinServerHandler;
}) {
  return new Elysia({ name: "huddle-http" })
    .use(errorHandling)
    .use(security())
    .options("/*", () => new Response(null, { status: 204 }))
    .use(publicRoutes)
    .use(mediaRoutes)
    .use(callIceConfigRoutes)
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
    .use(directCallRoutes)
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
