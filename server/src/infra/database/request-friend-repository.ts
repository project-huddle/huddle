import type { RequestFriendRepository } from "../../features/social/request-friend/request-friend.port";
import { db, userSelect, userView } from "./mappers";

export function createRequestFriendRepository(): RequestFriendRepository {
  return {
    async findUserByEmail(email) {
      const user = await db.user.findUnique({
        where: { email },
        select: userSelect,
      });
      return user ? userView(user) : null;
    },
    async hasReverseRequest(userId, targetId) {
      return Boolean(
        await db.friendship.findUnique({
          where: {
            requesterId_addresseeId: {
              requesterId: targetId,
              addresseeId: userId,
            },
          },
        }),
      );
    },
    async createRequest(userId, targetId) {
      await db.friendship.upsert({
        where: {
          requesterId_addresseeId: {
            requesterId: userId,
            addresseeId: targetId,
          },
        },
        create: { requesterId: userId, addresseeId: targetId },
        update: {},
      });
    },
  };
}
