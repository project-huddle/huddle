import { db } from "@/infra/database/client";
import { channelForUser } from "@/infra/database/server-repository";

export const mediaFilenamePattern = /^[a-f0-9-]+\.(jpg|png|gif|webp)$/;

export function localMediaFilename(url: string): string | null {
  if (!url.startsWith("/media/")) return null;
  const filename = url.slice(7);
  return mediaFilenamePattern.test(filename) ? filename : null;
}

export async function isPublicMedia(url: string) {
  const [avatar, icon] = await Promise.all([
    db.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    db.server.findFirst({ where: { iconUrl: url }, select: { id: true } }),
  ]);
  return Boolean(avatar || icon);
}

export async function canAccessMedia(url: string, userId: string | null): Promise<boolean> {
  const filename = localMediaFilename(url);
  if (!filename) return false;
  if (await isPublicMedia(url)) return true;
  if (!userId) return false;
  const upload = await db.uploadedMedia.findUnique({ where: { filename }, select: { ownerId: true } });
  if (upload?.ownerId === userId) return true;
  const directMessage = await db.directMessage.findFirst({
    where: { mediaUrl: url, OR: [{ senderId: userId }, { recipientId: userId }] },
    select: { id: true },
  });
  if (directMessage) return true;
  const channels = await db.message.findMany({
    where: { mediaUrl: url, deletedAt: null, channel: { server: { members: { some: { userId } } } } },
    distinct: ["channelId"], select: { channelId: true },
  });
  for (const { channelId } of channels) {
    if (await channelForUser(userId, channelId)) return true;
  }
  return false;
}

export async function canPublishMedia(url: string, userId: string): Promise<boolean> {
  const filename = localMediaFilename(url);
  if (!filename) return false;
  // Publishing an avatar/icon makes it public: only its uploader may do that.
  const upload = await db.uploadedMedia.findUnique({ where: { filename }, select: { ownerId: true } });
  return upload?.ownerId === userId || isPublicMedia(url);
}
