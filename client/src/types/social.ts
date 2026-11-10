import type { User, MessageMedia } from "@/lib/api";

export type Friendship = {
	status: "pending" | "accepted";
	direction: "incoming" | "outgoing";
	user: User;
};

export type DirectMessage = {
	media: MessageMedia | null;
	id: string;
	senderId: string;
	recipientId: string;
	content: string;
	createdAt: string;
};
