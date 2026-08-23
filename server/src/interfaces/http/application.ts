import { Elysia, t } from "elysia";
import { createChannelRoute } from "../../features/channels/create-channel/create-channel.route";
import { createAuthRoutes } from "./routes/auth";
import { createAccountSecurityRoutes } from "./routes/account-security";
import type { AccountService } from "../../app/account-service";
import type { IdentityService } from "../../app/identity-service";
import { createFriendRoutes } from "./routes/friends";
import type { RequestFriendRepository } from "../../features/social/request-friend/request-friend.port";
import type { FriendActionsRepository } from "../../features/social/friend-actions/friend-actions.port";
import type { ListFriendshipsRepository } from "../../features/social/list-friendships/list-friendships.port";
import { createDirectMessageRoutes } from "./routes/direct-messages";
import type { DirectMessagesRepository } from "../../features/social/direct-messages/direct-messages.port";
import type { CreateChannelHandler } from "../../features/channels/create-channel/create-channel";
import type { ChannelAccess } from "../../features/channels/channel-access.port";
import { listMessageHistoryRoute } from "../../features/messages/list-message-history/list-message-history.route";
import type { MessageHistoryRepository } from "../../features/messages/list-message-history/list-message-history.port";
import type { MessageActions } from "../../features/messages/message-actions.port";
import { createReportRoutes } from "./routes/reports";
import type { ModerationRepository } from "../../features/moderation/moderation-repository.port";
import { listChannelsRoute } from "../../features/channels/list-channels/list-channels.route";
import type { ListChannelsHandler } from "../../features/channels/list-channels/list-channels";
import { listServersRoute } from "../../features/servers/list-servers/list-servers.route";
import type { ListServersHandler } from "../../features/servers/list-servers/list-servers";
import { getServerRoute } from "../../features/servers/get-server/get-server.route";
import type { GetServerRepository } from "../../features/servers/get-server/get-server.port";
import { listMembersRoute } from "../../features/servers/list-members/list-members.route";
import type { ListMembersRepository } from "../../features/servers/list-members/list-members.port";
import { setMemberRoleRoute } from "../../features/servers/set-member-role/set-member-role.route";
import type { SetMemberRoleRepository } from "../../features/servers/set-member-role/set-member-role.port";
import { removeMemberRoute } from "../../features/servers/remove-member/remove-member.route";
import type { RemoveMemberRepository } from "../../features/servers/remove-member/remove-member.port";
import { createInviteRoute } from "../../features/servers/create-invite/create-invite.route";
import type { CreateInviteRepository } from "../../features/servers/create-invite/create-invite.port";
import { leaveServerRoute } from "../../features/servers/leave-server/leave-server.route";
import type { LeaveServerRepository } from "../../features/servers/leave-server/leave-server.port";
import type { JoinServerHandler } from "../../features/servers/join-server/join-server";
import { createServerRoute } from "../../features/servers/create-server/create-server.route";
import type { CreateServerHandler } from "../../features/servers/create-server/create-server";
import { joinServerRoute } from "../../features/servers/join-server/join-server.route";
import { config } from "../../config";
import {
  createRealtimeWebSocket,
  createRevokeUnauthorizedSocketAccess,
  hasValidWebSocketTicket,
  notifyUser,
} from "../realtime/realtime-gateway";
import { errorHandling } from "./plugins/errors";
import { security } from "./plugins/security";
import { createAccountRoutes } from "./routes/account";
import { gifRoutes } from "./routes/gifs";
import { publicRoutes } from "./routes/public";
import { uploadRoutes } from "./routes/uploads";

export function createHttpApplication(dependencies: {
  createChannel: CreateChannelHandler;
  createServer: CreateServerHandler;
  joinServer: JoinServerHandler;
  listChannels: ListChannelsHandler;
  listServers: ListServersHandler;
  getServerRepository: GetServerRepository;
  listMembersRepository: ListMembersRepository;
  setMemberRoleRepository: SetMemberRoleRepository;
  removeMemberRepository: RemoveMemberRepository;
  createInviteRepository: CreateInviteRepository;
  leaveServerRepository: LeaveServerRepository;
  channelAccess: ChannelAccess;
  listMessageHistoryRepository: MessageHistoryRepository;
  messageActions: MessageActions;
  moderationRepository: ModerationRepository;
  identityService: IdentityService;
  accountService: AccountService;
  requestFriendRepository: RequestFriendRepository;
  friendActionsRepository: FriendActionsRepository;
  listFriendshipsRepository: ListFriendshipsRepository;
  directMessagesRepository: DirectMessagesRepository;
}) {
  const revokeUnauthorizedSocketAccess = createRevokeUnauthorizedSocketAccess(
    dependencies.channelAccess,
  );
  const realtimeWebSocket = createRealtimeWebSocket(
    dependencies.channelAccess,
    dependencies.messageActions,
  );
  return new Elysia({ name: "huddle-http" })
    .use(errorHandling)
    .use(security())
    .options("/*", () => new Response(null, { status: 204 }))
    .use(publicRoutes)
    .use(createAuthRoutes(dependencies.identityService))
    .use(createChannelRoute(dependencies.createChannel))
    .use(listChannelsRoute(dependencies.listChannels))
    .use(listServersRoute(dependencies.listServers))
    .use(getServerRoute(dependencies.getServerRepository))
    .use(listMembersRoute(dependencies.listMembersRepository))
    .use(setMemberRoleRoute(dependencies.setMemberRoleRepository))
    .use(
      removeMemberRoute(
        dependencies.removeMemberRepository,
        revokeUnauthorizedSocketAccess,
      ),
    )
    .use(createInviteRoute(dependencies.createInviteRepository))
    .use(
      leaveServerRoute(
        dependencies.leaveServerRepository,
        revokeUnauthorizedSocketAccess,
      ),
    )
    .use(createServerRoute(dependencies.createServer))
    .use(createAccountRoutes(dependencies.accountService))
    .use(createAccountSecurityRoutes(dependencies.identityService, dependencies.accountService))
    .use(joinServerRoute(dependencies.joinServer))
    .use(uploadRoutes)
    .use(gifRoutes)
    .use(
      listMessageHistoryRoute(
        dependencies.listMessageHistoryRepository,
        dependencies.channelAccess,
      ),
    )
    .use(
      createFriendRoutes(
        dependencies.requestFriendRepository,
        dependencies.friendActionsRepository,
        dependencies.listFriendshipsRepository,
      ),
    )
    .use(
      createDirectMessageRoutes(
        dependencies.directMessagesRepository,
        notifyUser,
      ),
    )
    .use(createReportRoutes(dependencies.moderationRepository))
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
