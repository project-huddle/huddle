import { Elysia, t } from "elysia";
import {
  can,
  permissions,
  type Role,
} from "../../../core/moderation/permissions";
import { error, json } from "../../../http";
import { db } from "../../../infra/database/client";
import { sendMail } from "../../../infra/email/mailer";
import { authenticatedRoutes } from "../plugins/auth";
import { resourceId, serverIdParams, serverMemberParams } from "../schemas";

const reportBody = t.Object({
  reason: t.String(),
  serverId: t.Optional(resourceId),
  targetUserId: t.Optional(resourceId),
  messageId: t.Optional(resourceId),
});
const permissionsBody = t.Object({ permissions: t.Array(t.String()) });

export const reportRoutes = new Elysia({ name: "report-routes" })
  .use(authenticatedRoutes("authenticated-report-routes"))
  .post(
    "/reports",
    async ({ currentUser, body }) => {
      const reason = body.reason.trim();
      if (reason.length < 10 || reason.length > 1000)
        return error(
          400,
          "INVALID_REPORT",
          "Explique o problema usando entre 10 e 1000 caracteres.",
        );
      if (body.serverId) {
        const membership = await db.serverMember.findUnique({
          where: {
            serverId_userId: {
              serverId: body.serverId,
              userId: currentUser.id,
            },
          },
        });
        if (!membership)
          return error(403, "FORBIDDEN", "Você não pertence a este servidor.");
      }
      const report = await db.report.create({
        data: {
          reporterId: currentUser.id,
          serverId: body.serverId ?? null,
          targetUserId: body.targetUserId ?? null,
          messageId: body.messageId ?? null,
          reason,
        },
      });
      if (process.env.MODERATION_EMAIL)
        await sendMail({
          to: process.env.MODERATION_EMAIL,
          subject: "Novo report no Huddle",
          text: `Report ${report.id}: ${reason}`,
        });
      return json(
        { report: { ...report, createdAt: report.createdAt.toISOString() } },
        201,
      );
    },
    { body: reportBody },
  )
  .get(
    "/servers/:serverId/reports",
    async ({ currentUser, params }) => {
      const membership = await db.serverMember.findUnique({
        where: {
          serverId_userId: {
            serverId: params.serverId,
            userId: currentUser.id,
          },
        },
      });
      if (
        !membership ||
        !can(membership.role as Role, "reports.review", membership.permissions)
      )
        return error(
          403,
          "FORBIDDEN",
          "Você não possui permissão para revisar reports.",
        );
      return json({
        reports: await db.report.findMany({
          where: { serverId: params.serverId },
          orderBy: { createdAt: "desc" },
        }),
      });
    },
    { params: serverIdParams },
  )
  .patch(
    "/servers/:serverId/members/:memberId/permissions",
    async ({ currentUser, params, body }) => {
      const server = await db.server.findFirst({
        where: { id: params.serverId, ownerId: currentUser.id },
      });
      if (!server)
        return error(
          403,
          "FORBIDDEN",
          "Somente o proprietário pode personalizar permissões.",
        );
      const selected = body.permissions.filter((permission) =>
        permissions.includes(permission as never),
      );
      await db.serverMember.update({
        where: {
          serverId_userId: {
            serverId: params.serverId,
            userId: params.memberId,
          },
        },
        data: { permissions: selected },
      });
      return new Response(null, { status: 204 });
    },
    { params: serverMemberParams, body: permissionsBody },
  );
