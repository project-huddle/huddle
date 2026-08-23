export type ModerationRepository = {
  createReport(input: {
    reporterId: string;
    serverId: string | null;
    targetUserId: string | null;
    messageId: string | null;
    reason: string;
  }): Promise<Record<string, unknown>>;
  listReports(reviewerId: string, serverId: string): Promise<unknown[] | null>;
  setMemberPermissions(
    ownerId: string,
    serverId: string,
    memberId: string,
    permissions: string[],
  ): Promise<"ok" | "forbidden" | "missing">;
};
