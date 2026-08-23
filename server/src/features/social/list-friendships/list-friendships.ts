import type { ListFriendshipsRepository } from "./list-friendships.port";

export function listFriendships(
  repository: ListFriendshipsRepository,
  userId: string,
) {
  return repository.listFriendships(userId);
}
