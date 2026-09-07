import type { User } from "@/lib/api";

export type CallLifecycle = "idle" | "joining" | "active";

export type RealtimePeer = {
	user: User;
	audioStream: MediaStream | null;
	cameraStream: MediaStream | null;
	screenStream: MediaStream | null;
	screenAudioStream: MediaStream | null;
	sharing: boolean;
	muted: boolean;
	serverMuted: boolean;
	speaking: boolean;
};

export type VoicePresence = {
	channelId: string;
	users: User[];
};

export type SocketEvent = Record<string, unknown> & { type: string };
