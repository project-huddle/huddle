import type { ListChannelsRepository } from "./list-channels.port";

export type ListChannelsCommand = { userId: string; serverId: string };

export type ListChannelsResult =
  | {
      type: "success";
      channels: Awaited<
        ReturnType<ListChannelsRepository["listChannels"]>
      >["channels"];
    }
  | { type: "forbidden" };

export type ListChannelsHandler = (
  command: ListChannelsCommand,
) => Promise<ListChannelsResult>;

export function createListChannelsHandler({
  repository,
}: {
  repository: ListChannelsRepository;
}): ListChannelsHandler {
  return async ({ userId, serverId }) => {
    const result = await repository.listChannels(userId, serverId);
    if (!result.authorized) return { type: "forbidden" };
    return { type: "success", channels: result.channels };
  };
}
