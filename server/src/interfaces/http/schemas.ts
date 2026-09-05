import { t } from "elysia";

export const resourceId = t.String({ pattern: "^[a-f0-9-]+$" });
export const serverIdParams = t.Object({ serverId: resourceId });
export const serverMemberParams = t.Object({
  serverId: resourceId,
  memberId: resourceId,
});
export const userIdParams = t.Object({ userId: resourceId });

export const emailBody = t.Object({ email: t.String() });
export const createServerBody = t.Object({ name: t.String() });
export const createChannelBody = t.Object({
  name: t.String(),
  type: t.Optional(t.Union([t.Literal("text"), t.Literal("voice")])),
});
export const joinInviteBody = t.Object({ code: t.String() });
export const inviteCodeParams = t.Object({
  code: t.String({ pattern: "^[a-z0-9]{6,16}$" }),
});
export const createInviteBody = t.Object({
  durationHours: t.Optional(t.Integer({ minimum: 1 })),
});
export const memberRoleBody = t.Object({ role: t.String() });
