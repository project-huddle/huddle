import type { PublicProfile } from "@/core/identity/public-profile";

export type MessageMedia = {
  url: string;
  type: "image" | "gif";
  alt: string;
};

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  reactions: Record<string, number>;
  author: PublicProfile;
  media: MessageMedia | null;
  channelId: string;
};

export type AccessibleMessage = ChatMessage & { userId: string };
