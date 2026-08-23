import type { ChannelAccess } from "../../channels/channel-access.port";
import type { MessageHistoryRepository } from "./list-message-history.port";

export type ListMessageHistoryResult =
  | { type: "success"; messages: unknown[] }
  | { type: "forbidden" }
  | { type: "invalid-cursor" };

function historyLimit(value: string | undefined, maximum: number): number {
  const parsed = Number(value ?? 50);
  if (!Number.isInteger(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), maximum);
}

export async function listMessageHistory(
  repository: MessageHistoryRepository,
  channelAccess: ChannelAccess,
  userId: string,
  channelId: string | undefined,
  limit: string | undefined,
  before: string | undefined,
  maximumLimit: number,
): Promise<ListMessageHistoryResult> {
  const fallbackChannel = await channelAccess.firstChannelForUser(userId);
  const selectedChannelId = channelId || fallbackChannel?.id || "";
  if (!(await channelAccess.channelForUser(userId, selectedChannelId)))
    return { type: "forbidden" };
  if (before && Number.isNaN(Date.parse(before)))
    return { type: "invalid-cursor" };
  return {
    type: "success",
    messages: await repository.listMessageHistory(
      selectedChannelId,
      historyLimit(limit, maximumLimit),
      before,
    ),
  };
}
