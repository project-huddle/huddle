import { can, type Role } from "../../core/moderation/permissions";
import type { ModerationRepository } from "../../features/moderation/moderation-repository.port";
import { db } from "./client";

export function createModerationRepository(): ModerationRepository {
  return {
    async createReport(input) {
      const report = await db.report.create({ data: input });
      return { ...report, createdAt: report.createdAt.toISOString() };
    },
    async listReports(reviewerId, serverId) {
      const membership = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: reviewerId } },
        select: { role: true, permissions: true },
      });
      if (
        !membership ||
        !can(membership.role as Role, "reports.review", membership.permissions)
      )
        return null;
      return db.report.findMany({
        where: { serverId },
        orderBy: { createdAt: "desc" },
      });
    },
    async setMemberPermissions(ownerId, serverId, memberId, permissions) {
      const server = await db.server.findFirst({
        where: { id: serverId, ownerId },
        select: { id: true },
      });
      if (!server) return "forbidden";
      const member = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: memberId } },
        select: { userId: true },
      });
      if (!member) return "missing";
      await db.serverMember.update({
        where: { serverId_userId: { serverId, userId: memberId } },
        data: { permissions },
      });
      return "ok";
    },
  };
}
