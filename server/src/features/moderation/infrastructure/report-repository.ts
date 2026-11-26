import { db } from "@/shared/infrastructure/database/client";

export async function hasServerMembership(
  userId: string,
  serverId: string,
): Promise<boolean> {
  const membership = await db.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { userId: true },
  });
  return membership !== null;
}

export async function hasServerMessage(
  messageId: string,
  serverId: string,
): Promise<boolean> {
  const message = await db.message.findFirst({
    where: { id: messageId, channel: { serverId } },
    select: { id: true },
  });
  return message !== null;
}

export async function createReport(input: {
  reporterId: string;
  serverId: string | null;
  targetUserId: string | null;
  messageId: string | null;
  reason: string;
}) {
  return db.report.create({ data: input });
}

export async function listReportsForServer(serverId: string) {
  return db.report.findMany({
    where: { serverId },
    orderBy: { createdAt: "desc" },
  });
}

export async function isServerOwner(
  userId: string,
  serverId: string,
): Promise<boolean> {
  const server = await db.server.findFirst({
    where: { id: serverId, ownerId: userId },
    select: { id: true },
  });
  return server !== null;
}

export async function updateMemberPermissions(
  serverId: string,
  memberId: string,
  permissions: string[],
): Promise<void> {
  await db.serverMember.update({
    where: { serverId_userId: { serverId, userId: memberId } },
    data: { permissions },
  });
}
