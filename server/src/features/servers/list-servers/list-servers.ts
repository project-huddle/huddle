import type { ListServersRepository } from "./list-servers.port";

export type ListServersHandler = (
  userId: string,
) => Promise<Awaited<ReturnType<ListServersRepository["listServers"]>>>;

export function createListServersHandler({
  repository,
}: {
  repository: ListServersRepository;
}): ListServersHandler {
  return (userId) => repository.listServers(userId);
}
