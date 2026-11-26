import { db } from "../../../shared/infrastructure/database/client";
import type { ServerInvite } from "@/features/servers/types/server";
import { hasServerPermission } from "./server-member-repository";
import { serverForUser } from "./server-repository";
export type InviteDetails = {
  code: string;
  expiresAt: Date;
  server: { id: string; name: string };
};
export async function findInviteByCode(code: string): Promise<InviteDetails | null> {
  return db.invite.findUnique({
    where: { code },
    select: {
      code: true,
      expiresAt: true,
      server: { select: { id: true, name: true } },
    },
  });
}
export async function createInvite(
  userId: string,
  serverId: string,
  durationHours = 2,
): Promise<ServerInvite | null> {
  const member = await db.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { role: true } });
  if (!member || !(await hasServerPermission(userId, serverId, "invites.create"))) return null;
  if (!Number.isSafeInteger(durationHours) || durationHours < 1) return null;
  if (member.role !== "owner" && durationHours !== 2) return null;
  const invite = await db.invite.create({
    data: {
      code: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
      serverId,
      createdBy: userId,
      expiresAt: new Date(Date.now() + durationHours * 3_600_000),
    },
  });
  return {
    code: invite.code,
    serverId,
    expiresAt: invite.expiresAt.toISOString(),
  };
}
export async function leaveServer(
  userId: string,
  serverId: string,
): Promise<"left" | "owner" | "missing"> {
  const server = await serverForUser(userId, serverId);
  if (!server) return "missing";
  if (server.ownerId === userId) return "owner";
  await db.serverMember.delete({
    where: { serverId_userId: { serverId, userId } },
  });
  return "left";
}
