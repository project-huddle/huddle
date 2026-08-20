import type { User } from "@/lib/api";

export type Friendship = {
	status: "pending" | "accepted";
	direction: "incoming" | "outgoing";
	user: User;
};

export type DirectMessage = {
	id: string;
	senderId: string;
	recipientId: string;
	content: string;
	createdAt: string;
};
