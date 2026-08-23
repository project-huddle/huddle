import type { FriendActionsRepository } from "./friend-actions.port";

export async function acceptFriend(
  repository: FriendActionsRepository,
  userId: string,
  requesterId: string,
): Promise<"success" | "not-found"> {
  return (await repository.acceptFriend(userId, requesterId))
    ? "success"
    : "not-found";
}

export async function deleteFriendship(
  repository: FriendActionsRepository,
  userId: string,
  peerId: string,
): Promise<void> {
  await repository.deleteFriendship(userId, peerId);
}
