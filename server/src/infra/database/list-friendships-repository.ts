import type { ListFriendshipsRepository } from "../../features/social/list-friendships/list-friendships.port";
import { db, userSelect, userView } from "./mappers";

export function createListFriendshipsRepository(): ListFriendshipsRepository {
  return {
    async listFriendships(userId) {
      const rows = await db.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: {
          requester: { select: userSelect },
          addressee: { select: userSelect },
        },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((row) => {
        const outgoing = row.requesterId === userId;
        return {
          status: row.status,
          direction: outgoing ? "outgoing" : "incoming",
          user: userView(outgoing ? row.addressee : row.requester),
        };
      });
    },
  };
}
