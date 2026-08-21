import { Prisma } from "@prisma/client";
import type { User } from "../infra/database/identity-repository";
import { db } from "../infra/database/client";
import { messageContent, validEmail } from "../validation";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  countryCode: true,
  ageGroup: true,
  ageVerifiedAt: true,
  ageVerificationProvider: true,
  twoFactorEnabled: true,
} satisfies Prisma.UserSelect;
type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function publicUser(row: PublicUserRow) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    ageVerifiedAt: row.ageVerifiedAt?.toISOString() ?? null,
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
  rawEmail: string,
): Promise<RequestFriendResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!validEmail(email) || email === user.email) return { type: "invalid" };
  const target = await db.user.findUnique({
    where: { email },
    select: publicUserSelect,
  });
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
