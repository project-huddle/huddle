import { db } from "@/shared/infrastructure/database/client";

export type UploadedImageContentType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export async function recordUploadedMedia(input: {
  filename: string;
  ownerId: string;
  contentType: UploadedImageContentType;
}): Promise<void> {
  await db.uploadedMedia.create({ data: input });
}

export async function ownerOfUploadedMedia(
  filename: string,
): Promise<string | null> {
  const media = await db.uploadedMedia.findUnique({
    where: { filename },
    select: { ownerId: true },
  });
  return media?.ownerId ?? null;
}

export async function isPublicMediaUrl(url: string): Promise<boolean> {
  const [avatar, icon] = await Promise.all([
    db.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    db.server.findFirst({ where: { iconUrl: url }, select: { id: true } }),
  ]);
  return Boolean(avatar || icon);
}

export async function isDirectMessageMediaForUser(
  url: string,
  userId: string,
): Promise<boolean> {
  const message = await db.directMessage.findFirst({
    where: { mediaUrl: url, OR: [{ senderId: userId }, { recipientId: userId }] },
    select: { id: true },
  });
  return message !== null;
}

export async function channelsContainingMedia(
  url: string,
  userId: string,
): Promise<string[]> {
  const messages = await db.message.findMany({
    where: {
      mediaUrl: url,
      deletedAt: null,
      channel: { server: { members: { some: { userId } } } },
    },
    distinct: ["channelId"],
    select: { channelId: true },
  });
  return messages.map(({ channelId }) => channelId);
}
