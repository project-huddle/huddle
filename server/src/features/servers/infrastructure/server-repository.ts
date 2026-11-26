import { db, serverView } from "../../../shared/infrastructure/database/mappers";
import type { User } from "@/features/auth/types/user";
import type { Server } from "@/features/servers/types/server";
import { defaultMemberPermissions } from "@/core/moderation/permissions";
export async function createServer(
  user: User,
  name: string,
): Promise<{ server: Server; channel: Channel }> {
  const result = await db.$transaction(async (tx) => {
    const server = await tx.server.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
        channels: { create: { name: "geral" } },
      },
      include: { channels: true },
    });
    const everyone = await tx.serverRole.create({
      data: {
        serverId: server.id,
        name: "Membro",
        isDefault: true,
        position: 0,
        permissions: {
          create: defaultMemberPermissions.map((permissionKey) => ({ permissionKey })),
        },
      },
    });
    await tx.serverMemberRole.create({ data: { serverId: server.id, userId: user.id, roleId: everyone.id } });
    return server;
  });
  return {
    server: serverView(result),
    channel: channelView(result.channels[0]!),
  };
}
export async function listServers(userId: string): Promise<Server[]> {
  return (
    await db.server.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    })
  ).map(serverView);
}
export async function serverForUser(
  userId: string,
  serverId: string,
): Promise<Server | null> {
  const server = await db.server.findFirst({
    where: { id: serverId, members: { some: { userId } } },
  });
  return server ? serverView(server) : null;
}
export async function updateServer(actorId: string, serverId: string, input: { name?: string; iconUrl?: string | null }) {
  const server = await db.server.findFirst({ where: { id: serverId } });
  if (!server || !(await hasServerPermission(actorId, serverId, "server.settings.manage"))) return null;
  if (input.iconUrl !== undefined && input.iconUrl !== null && !/^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(input.iconUrl)) return null;
  if (input.iconUrl && input.iconUrl !== server.iconUrl) {
    const upload = await db.uploadedMedia.findUnique({where:{filename:input.iconUrl.slice(7)},select:{ownerId:true}});
    if (upload?.ownerId !== actorId) return null;
  }
  const updated = await db.server.update({ where: { id: serverId }, data: input });
  return serverView(updated);
}
export async function deleteServer(actorId: string, serverId: string): Promise<boolean> {
  const result = await db.server.deleteMany({
    where: { id: serverId, ownerId: actorId },
  });
  return result.count > 0;
}
export async function transferServerOwnership(
  actorId: string,
  serverId: string,
  newOwnerId: string,
): Promise<"transferred" | "forbidden" | "target-not-member" | "same-owner"> {
  if (actorId === newOwnerId) return "same-owner";

  return db.$transaction(async (tx) => {
    const target = await tx.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: newOwnerId } },
      select: { userId: true },
    });
    if (!target) return "target-not-member";

    const ownership = await tx.server.updateMany({
      where: { id: serverId, ownerId: actorId },
      data: { ownerId: newOwnerId },
    });
    if (ownership.count === 0) return "forbidden";
    await tx.serverMember.update({
      where: { serverId_userId: { serverId, userId: actorId } },
      data: { role: "member" },
    });
    await tx.serverMember.update({
      where: { serverId_userId: { serverId, userId: newOwnerId } },
      data: { role: "owner" },
    });

    return "transferred";
  });
}
