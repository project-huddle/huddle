import type { User } from "@/lib/api";

export type CallLifecycle = "idle" | "joining" | "active";

export type RealtimePeer = {
	user: User;
	audioStream: MediaStream | null;
	cameraStream: MediaStream | null;
	screenStream: MediaStream | null;
	sharing: boolean;
};

export type SocketEvent = Record<string, unknown> & { type: string };
