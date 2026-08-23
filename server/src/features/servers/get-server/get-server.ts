import type { GetServerRepository } from "./get-server.port";

export type GetServerResult =
  | {
      type: "success";
      server: NonNullable<
        Awaited<ReturnType<GetServerRepository["getServer"]>>
      >;
    }
  | { type: "forbidden" };

export async function getServer(
  repository: GetServerRepository,
  userId: string,
  serverId: string,
): Promise<GetServerResult> {
  const server = await repository.getServer(userId, serverId);
  return server ? { type: "success", server } : { type: "forbidden" };
}
