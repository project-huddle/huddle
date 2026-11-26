import { Prisma } from "@prisma/client";
import { db } from "@/shared/infrastructure/database/client";

const publicUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type SocialUser = Omit<PublicUserRecord, "createdAt"> & {
  createdAt: string;
};

function toSocialUser(user: PublicUserRecord): SocialUser {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export async function listFriendshipRows(userId: string) {
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    requesterId: row.requesterId,
    status: row.status,
    requester: toSocialUser(row.requester),
    addressee: toSocialUser(row.addressee),
  }));
}

export async function findSocialUser(identifier: {
  id?: string;
  email?: string;
  username?: string;
}): Promise<SocialUser | null> {
  let where: Prisma.UserWhereUniqueInput;
  if (identifier.id) {
    where = { id: identifier.id };
  } else if (identifier.email) {
    where = { email: identifier.email };
  } else if (identifier.username) {
    where = { username: identifier.username };
  } else {
    return null;
  }
  const user = await db.user.findUnique({ where, select: publicUserSelect });
  return user ? toSocialUser(user) : null;
}

export async function hasFriendshipRequest(
  requesterId: string,
  addresseeId: string,
): Promise<boolean> {
  const friendship = await db.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId, addresseeId } },
    select: { requesterId: true },
  });
  return friendship !== null;
}

export async function createFriendshipRequest(
  requesterId: string,
  addresseeId: string,
): Promise<void> {
  await db.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId, addresseeId } },
    create: { requesterId, addresseeId },
    update: {},
  });
}

export async function acceptFriendship(
  userId: string,
  requesterId: string,
): Promise<boolean> {
  const updated = await db.friendship.updateMany({
    where: { requesterId, addresseeId: userId, status: "pending" },
    data: { status: "accepted" },
  });
  return updated.count > 0;
}

export async function deleteFriendships(
  userId: string,
  peerId: string,
): Promise<void> {
  await db.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: peerId },
        { requesterId: peerId, addresseeId: userId },
      ],
    },
  });
}

export async function areFriendAccounts(
  userId: string,
  peerId: string,
): Promise<boolean> {
  const friendship = await db.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: peerId },
        { requesterId: peerId, addresseeId: userId },
      ],
    },
    select: { requesterId: true },
  });
  return friendship !== null;
}
