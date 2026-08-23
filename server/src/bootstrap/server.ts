import { createCreateChannelHandler } from "../features/channels/create-channel/create-channel";
import { createChannelAccessRepository } from "../infra/database/channel-access-repository";
import { createMessageActionsRepository } from "../infra/database/message-actions-repository";
import { createIdentityTokenRepository } from "../infra/database/identity-token-repository";
import { createIdentityService } from "../app/identity-service";
import { createAccountRepository } from "../infra/database/account-repository";
import { createAccountService } from "../app/account-service";
import { createRequestFriendRepository } from "../infra/database/request-friend-repository";
import { createFriendActionsRepository } from "../infra/database/friend-actions-repository";
import { createListFriendshipsRepository } from "../infra/database/list-friendships-repository";
import { createDirectMessagesRepository } from "../infra/database/direct-messages-repository";
import { createModerationRepository } from "../infra/database/moderation-repository";
import { createListMessageHistoryRepository } from "../infra/database/list-message-history-repository";
import { createListChannelsHandler } from "../features/channels/list-channels/list-channels";
import { createListServersHandler } from "../features/servers/list-servers/list-servers";
import { listMembersRoute } from "../features/servers/list-members/list-members.route";
import { setMemberRoleRoute } from "../features/servers/set-member-role/set-member-role.route";
import { removeMemberRoute } from "../features/servers/remove-member/remove-member.route";
import { createInviteRoute } from "../features/servers/create-invite/create-invite.route";
import { leaveServerRoute } from "../features/servers/leave-server/leave-server.route";
import { createCreateServerHandler } from "../features/servers/create-server/create-server";
import { getServerRoute } from "../features/servers/get-server/get-server.route";
import { createJoinServer } from "../features/servers/join-server/join-server";
import { createHttpApplication } from "../interfaces/http/application";
import { createCreateChannelRepository } from "../infra/database/create-channel-repository";
import { createListChannelsRepository } from "../infra/database/list-channels-repository";
import { createListServersRepository } from "../infra/database/list-servers-repository";
import { createListMembersRepository } from "../infra/database/list-members-repository";
import { createSetMemberRoleRepository } from "../infra/database/set-member-role-repository";
import { createRemoveMemberRepository } from "../infra/database/remove-member-repository";
import { createCreateInviteRepository } from "../infra/database/create-invite-repository";
import { createLeaveServerRepository } from "../infra/database/leave-server-repository";
import { createCreateServerRepository } from "../infra/database/create-server-repository";
import { createGetServerRepository } from "../infra/database/get-server-repository";
import { createJoinServerRepository } from "../infra/database/join-server-repository";

export function createServerApplication() {
  const identityService = createIdentityService(
    createIdentityTokenRepository(),
  );
  const accountService = createAccountService(createAccountRepository());
  const channelAccess = createChannelAccessRepository();
  const createChannelRepository = createCreateChannelRepository();
  const createChannel = createCreateChannelHandler({
    repository: createChannelRepository,
  });
  const listChannels = createListChannelsHandler({
    repository: createListChannelsRepository(),
  });
  const listServers = createListServersHandler({
    repository: createListServersRepository(),
  });
  const getServerRepository = createGetServerRepository();
  const createServerRepository = createCreateServerRepository();
  const createServer = createCreateServerHandler({
    repository: createServerRepository,
  });
  const joinServerRepository = createJoinServerRepository();
  const joinServer = createJoinServer({ repository: joinServerRepository });

  return createHttpApplication({
    createChannel,
    createServer,
    joinServer,
    listChannels,
    listServers,
    getServerRepository,
    listMembersRepository: createListMembersRepository(),
    setMemberRoleRepository: createSetMemberRoleRepository(),
    removeMemberRepository: createRemoveMemberRepository(),
    createInviteRepository: createCreateInviteRepository(),
    leaveServerRepository: createLeaveServerRepository(),
    channelAccess,
    listMessageHistoryRepository: createListMessageHistoryRepository(),
    messageActions: createMessageActionsRepository(),
    moderationRepository: createModerationRepository(),
    identityService,
    accountService,
    requestFriendRepository: createRequestFriendRepository(),
    friendActionsRepository: createFriendActionsRepository(),
    listFriendshipsRepository: createListFriendshipsRepository(),
    directMessagesRepository: createDirectMessagesRepository(),
  });
}
