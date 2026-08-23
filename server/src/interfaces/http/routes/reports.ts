import { Elysia, t } from "elysia";
import { permissions } from "../../../core/moderation/permissions";
import { error, json } from "../../../http";
import { sendMail } from "../../../infra/email/mailer";
import type { ModerationRepository } from "../../../features/moderation/moderation-repository.port";
import { authenticatedRoutes } from "../plugins/auth";
import { resourceId, serverIdParams, serverMemberParams } from "../schemas";

const reportBody = t.Object({
  reason: t.String(),
  serverId: t.Optional(resourceId),
  targetUserId: t.Optional(resourceId),
  messageId: t.Optional(resourceId),
});
const permissionsBody = t.Object({ permissions: t.Array(t.String()) });

export function createReportRoutes(repository: ModerationRepository) {
  return new Elysia({ name: "report-routes" })
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
        const report = await repository.createReport({
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
        return json({ report }, 201);
      },
      { body: reportBody },
    )
    .get(
      "/servers/:serverId/reports",
      async ({ currentUser, params }) => {
        const reports = await repository.listReports(
          currentUser.id,
          params.serverId,
        );
        if (!reports)
          return error(
            403,
            "FORBIDDEN",
            "Você não possui permissão para revisar reports.",
          );
        return json({ reports });
      },
      { params: serverIdParams },
    )
    .patch(
      "/servers/:serverId/members/:memberId/permissions",
      async ({ currentUser, params, body }) => {
        const selected = body.permissions.filter((permission) =>
          permissions.includes(permission as never),
        );
        const result = await repository.setMemberPermissions(
          currentUser.id,
          params.serverId,
          params.memberId,
          selected,
        );
        if (result === "forbidden")
          return error(
            403,
            "FORBIDDEN",
            "Somente o proprietário pode personalizar permissões.",
          );
        if (result === "missing")
          return error(404, "NOT_FOUND", "Member not found.");
        return new Response(null, { status: 204 });
      },
      { params: serverMemberParams, body: permissionsBody },
    );
}
