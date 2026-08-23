import { can, type Permission } from "../../core/moderation/permissions";
import { channelView, db, type ServerRole } from "./mappers";
import type {
  CreateChannelRepository,
  CreatedChannel,
} from "../../features/channels/create-channel/create-channel.port";

export function createCreateChannelRepository(): CreateChannelRepository {
  return {
    async createChannel(
      userId,
      serverId,
      name,
    ): Promise<CreatedChannel | null> {
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId } },
        select: { role: true, permissions: true },
      });
      const permission: Permission = "channels.create";
      if (
        !member ||
        !can(member.role as ServerRole, permission, member.permissions)
      )
        return null;

      return channelView(await db.channel.create({ data: { serverId, name } }));
    },
  };
}
