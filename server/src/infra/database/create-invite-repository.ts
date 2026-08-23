import { can } from "../../core/moderation/permissions";
import type { CreateInviteRepository } from "../../features/servers/create-invite/create-invite.port";
import { db, type ServerRole } from "./mappers";

export function createCreateInviteRepository(): CreateInviteRepository {
  return {
    async createInvite(userId, serverId) {
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId } },
        select: { role: true, permissions: true },
      });
      if (
        !member ||
        !can(member.role as ServerRole, "invites.create", member.permissions)
      )
        return null;

      const invite = await db.invite.create({
        data: {
          code: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
          serverId,
          createdBy: userId,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      return {
        code: invite.code,
        serverId,
        expiresAt: invite.expiresAt.toISOString(),
      };
    },
  };
}
