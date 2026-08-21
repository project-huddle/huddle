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
export const createChannelBody = t.Object({ name: t.String() });
export const joinInviteBody = t.Object({ code: t.String() });
export const memberRoleBody = t.Object({ role: t.String() });
