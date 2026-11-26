import { channelForUser } from "@/features/servers/infrastructure/server-channel-repository";
import {
  channelsContainingMedia,
  isDirectMessageMediaForUser,
  isPublicMediaUrl,
  ownerOfUploadedMedia,
} from "../infrastructure/upload-repository";

export const mediaFilenamePattern = /^[a-f0-9-]+\.(jpg|png|gif|webp)$/;

export function localMediaFilename(url: string): string | null {
  if (!url.startsWith("/media/")) return null;
  const filename = url.slice(7);
  return mediaFilenamePattern.test(filename) ? filename : null;
}

export async function isPublicMedia(url: string) {
  return isPublicMediaUrl(url);
}

export async function canAccessMedia(url: string, userId: string | null): Promise<boolean> {
  const filename = localMediaFilename(url);
  if (!filename) return false;
  if (await isPublicMedia(url)) return true;
  if (!userId) return false;
  const ownerId = await ownerOfUploadedMedia(filename);
  if (ownerId === userId) return true;
  if (await isDirectMessageMediaForUser(url, userId)) return true;
  const channelIds = await channelsContainingMedia(url, userId);
  for (const channelId of channelIds) {
    if (await channelForUser(userId, channelId)) return true;
  }
  return false;
}

export async function canPublishMedia(url: string, userId: string): Promise<boolean> {
  const filename = localMediaFilename(url);
  if (!filename) return false;
  // Publishing an avatar/icon makes it public: only its uploader may do that.
  const ownerId = await ownerOfUploadedMedia(filename);
  return ownerId === userId || isPublicMedia(url);
}
