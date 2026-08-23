import type {
  CreateChannelRepository,
  CreatedChannel,
} from "./create-channel.port";

export type CreateChannelCommand = {
  userId: string;
  serverId: string;
  name: string;
};

export type CreateChannelResult =
  | { type: "success"; channel: CreatedChannel }
  | { type: "invalid-name" }
  | { type: "forbidden" };

export type CreateChannelHandler = (
  command: CreateChannelCommand,
) => Promise<CreateChannelResult>;

function normalizeName(rawName: string): string | null {
  const name = rawName.trim().toLowerCase().replace(/\s+/g, "-");
  return /^[a-z0-9-_]{2,32}$/.test(name) ? name : null;
}

export function createCreateChannelHandler({
  repository,
}: {
  repository: CreateChannelRepository;
}): CreateChannelHandler {
  return async ({ userId, serverId, name }) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return { type: "invalid-name" };

    const channel = await repository.createChannel(
      userId,
      serverId,
      normalizedName,
    );
    if (!channel) return { type: "forbidden" };
    return { type: "success", channel };
  };
}
