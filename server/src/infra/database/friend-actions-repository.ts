import type { FriendActionsRepository } from "../../features/social/friend-actions/friend-actions.port";
import { db } from "./client";

export function createFriendActionsRepository(): FriendActionsRepository {
  return {
    async acceptFriend(userId, requesterId) {
      const updated = await db.friendship.updateMany({
        where: { requesterId, addresseeId: userId, status: "pending" },
        data: { status: "accepted" },
      });
      return updated.count > 0;
    },
    async deleteFriendship(userId, peerId) {
      await db.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: userId, addresseeId: peerId },
            { requesterId: peerId, addresseeId: userId },
          ],
        },
      });
    },
  };
}
