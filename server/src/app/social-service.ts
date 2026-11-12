import { isValidUsername, normalizeUsername } from "@/core/identity/username";
import { Prisma } from "@prisma/client";
import type { User } from "../infra/database/identity-repository";
import { db } from "../infra/database/client";
import { validEmail } from "./validation";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  countryCode: true,
  twoFactorEnabled: true,
} satisfies Prisma.UserSelect;
type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function publicUser(row: PublicUserRow) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
  };
}

export async function listFriendships(userId: string) {
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => {
    const isOutgoing = row.requesterId === userId;
    return {
      status: row.status,
      direction: isOutgoing ? "outgoing" : "incoming",
      user: publicUser(isOutgoing ? row.addressee : row.requester),
    };
  });
}

export type RequestFriendResult =
  | { type: "success"; user: ReturnType<typeof publicUser> }
  | { type: "invalid" }
  | { type: "not-found" }
  | { type: "exists" };

export async function requestFriend(
  user: User,
  rawIdentifier: string,
): Promise<RequestFriendResult> {
  const value = rawIdentifier.trim();
  const friendId = extractFriendId(value);
  if (friendId === user.id) return { type: "invalid" };
  const username = normalizeUsername(value);
  const isEmail = validEmail(value.toLowerCase());
  if (!friendId && !isEmail && !isValidUsername(username))
    return { type: "invalid" };
  let where: Prisma.UserWhereUniqueInput;
  if (friendId) where = { id: friendId };
  else if (isEmail) where = { email: value.toLowerCase() };
  else where = { username };
  const target = await db.user.findUnique({ where, select: publicUserSelect });
  if (target?.id === user.id) return { type: "invalid" };
  if (!target) return { type: "not-found" };
  const reverse = await db.friendship.findUnique({
    where: {
      requesterId_addresseeId: { requesterId: target.id, addresseeId: user.id },
    },
  });
  if (reverse) return { type: "exists" };
  await db.friendship.upsert({
    where: {
      requesterId_addresseeId: { requesterId: user.id, addresseeId: target.id },
    },
    create: { requesterId: user.id, addresseeId: target.id },
    update: {},
  });
  return { type: "success", user: publicUser(target) };
}

function extractFriendId(value: string): string | null {
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (uuid.test(value)) return value;
  try {
    const candidate = new URL(value).searchParams.get("friend");
    return candidate && uuid.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export async function acceptFriend(
  userId: string,
  requesterId: string,
): Promise<boolean> {
  const updated = await db.friendship.updateMany({
    where: { requesterId, addresseeId: userId, status: "pending" },
    data: { status: "accepted" },
  });
  return updated.count > 0;
}

export async function deleteFriendship(
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

export async function areFriends(
  userId: string,
  peerId: string,
): Promise<boolean> {
  return Boolean(
    await db.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: peerId },
          { requesterId: peerId, addresseeId: userId },
        ],
      },
      select: { requesterId: true },
    }),
  );
}
