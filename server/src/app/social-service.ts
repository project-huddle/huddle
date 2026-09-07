import { Prisma } from "@prisma/client";
import type { User } from "../infra/database/identity-repository";
import { db } from "../infra/database/client";
import { messageContent, validEmail } from "./validation";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
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
  const target = friendId
    ? await db.user.findUnique({ where: { id: friendId }, select: publicUserSelect })
    : await db.user.findUnique({
        where: { email: value.toLowerCase() },
        select: publicUserSelect,
      });
  if (!friendId && (!validEmail(value.toLowerCase()) || value.toLowerCase() === user.email))
    return { type: "invalid" };
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
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
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

async function areFriends(userId: string, peerId: string): Promise<boolean> {
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

export async function directMessageHistory(userId: string, peerId: string) {
  if (!(await areFriends(userId, peerId))) return null;
  const messages = await db.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: peerId },
        { senderId: peerId, recipientId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  }));
}

export type SendDirectMessageResult =
  | {
      type: "success";
      message: Awaited<ReturnType<typeof createDirectMessage>>;
    }
  | { type: "not-friends" }
  | { type: "invalid-message" };

async function createDirectMessage(
  senderId: string,
  recipientId: string,
  content: string,
) {
  const created = await db.directMessage.create({
    data: { senderId, recipientId, content },
  });
  return {
    ...created,
    createdAt: created.createdAt.toISOString(),
    readAt: null,
  };
}

export async function sendDirectMessage(
  userId: string,
  recipientId: string,
  rawContent: string,
): Promise<SendDirectMessageResult> {
  if (!(await areFriends(userId, recipientId))) return { type: "not-friends" };
  const content = messageContent(rawContent);
  if (!content) return { type: "invalid-message" };
  return {
    type: "success",
    message: await createDirectMessage(userId, recipientId, content),
  };
}
