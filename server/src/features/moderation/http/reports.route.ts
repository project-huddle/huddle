import { Elysia, t } from "elysia";
import { permissions } from "@/core/moderation/permissions";
import { error, json } from "@/interfaces/http/responses";
import { hasServerPermission } from "@/features/servers/infrastructure/server-member-repository";
import { sendMail } from "@/features/auth/infrastructure/mailer";
import {
  createReport,
  hasServerMembership,
  hasServerMessage,
  isServerOwner,
  listReportsForServer,
  updateMemberPermissions,
} from "@/features/moderation/infrastructure/report-repository";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import {
  resourceId,
  serverIdParams,
  serverMemberParams,
} from "../../../interfaces/http/schemas";

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
        if (!(await hasServerMembership(currentUser.id, body.serverId)))
          return error(403, "FORBIDDEN", "Você não pertence a este servidor.");
        if (
          body.messageId &&
          !(await hasServerMessage(body.messageId, body.serverId))
        )
          return error(
            404,
            "NOT_FOUND",
            "Mensagem não encontrada neste servidor.",
          );
      }
      const report = await createReport({
        reporterId: currentUser.id,
        serverId: body.serverId ?? null,
        targetUserId: body.targetUserId ?? null,
        messageId: body.messageId ?? null,
        reason,
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
      const isMember = await hasServerMembership(
        currentUser.id,
        params.serverId,
      );
      const canReviewReports = await hasServerPermission(
        currentUser.id,
        params.serverId,
        "reports.review",
      );
      if (!isMember || !canReviewReports)
        return error(
          403,
          "FORBIDDEN",
          "Você não possui permissão para revisar reports.",
        );
      return json({
        reports: await listReportsForServer(params.serverId),
      });
    },
    { params: serverIdParams },
  )
  .patch(
    "/servers/:serverId/members/:memberId/permissions",
    async ({ currentUser, params, body }) => {
      if (!(await isServerOwner(currentUser.id, params.serverId)))
        return error(
          403,
          "FORBIDDEN",
          "Somente o proprietário pode personalizar permissões.",
        );
      const selected = body.permissions.filter((permission) =>
        permissions.includes(permission as never),
      );
      await updateMemberPermissions(params.serverId, params.memberId, selected);
      return new Response(null, { status: 204 });
    },
    { params: serverMemberParams, body: permissionsBody },
  );
