import type {
  CreateServerRepository,
  CreatedServer,
} from "./create-server.port";

export type CreateServerCommand = {
  userId: string;
  name: string;
};

export type CreateServerResult =
  { type: "success"; created: CreatedServer } | { type: "invalid-name" };

export type CreateServerHandler = (
  command: CreateServerCommand,
) => Promise<CreateServerResult>;

function normalizeName(rawName: string): string | null {
  const name = rawName.trim();
  return name.length >= 2 && name.length <= 40 ? name : null;
}

export function createCreateServerHandler({
  repository,
}: {
  repository: CreateServerRepository;
}): CreateServerHandler {
  return async ({ userId, name }) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return { type: "invalid-name" };

    return {
      type: "success",
      created: await repository.createServer(userId, normalizedName),
    };
  };
}
