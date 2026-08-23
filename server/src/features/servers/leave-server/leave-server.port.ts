export type LeaveServerRepository = {
  leaveServer(
    userId: string,
    serverId: string,
  ): Promise<"left" | "owner" | "missing">;
};
