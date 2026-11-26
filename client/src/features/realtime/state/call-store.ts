import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCallback, useMemo } from "react";
import type { SetStateAction } from "react";

import type { RealtimePeer } from "@/types/realtime";

export type CallState = {
	joining: boolean;
	inCall: boolean;
	muted: boolean;
	cameraOff: boolean;
	sharing: boolean;
	localMediaStream: MediaStream | null;
	localDisplayStream: MediaStream | null;
	peers: RealtimePeer[];
	serverMuted: boolean;
};

type CallStore = {
	sessions: Record<string, CallState>;
	updateSession: (
		sessionId: string,
		update: (state: CallState) => CallState,
	) => void;
	resetSession: (sessionId: string) => void;
};

const initialState: CallState = {
	joining: false,
	inCall: false,
	muted: false,
	cameraOff: true,
	sharing: false,
	localMediaStream: null,
	localDisplayStream: null,
	peers: [],
	serverMuted: false,
};

export const useCallStore = create<CallStore>((set) => ({
	sessions: {},
	updateSession: (sessionId, update) =>
		set((store) => {
			const current = store.sessions[sessionId] ?? initialState;
			return {
				sessions: {
					...store.sessions,
					[sessionId]: update(current),
				},
			};
		}),
	resetSession: (sessionId) =>
		set((store) => {
			if (!store.sessions[sessionId]) return store;
			const sessions = { ...store.sessions };
			delete sessions[sessionId];
			return { sessions };
		}),
}));

export function useCallState(sessionId: string) {
	const state = useCallStore(
		useShallow((store) => store.sessions[sessionId] ?? initialState),
	);
	const updateSession = useCallStore((store) => store.updateSession);
	const resetSession = useCallStore((store) => store.resetSession);
	const setField = useCallback(
		<Key extends keyof CallState>(
			key: Key,
			value: SetStateAction<CallState[Key]>,
		) =>
			updateSession(sessionId, (current) => {
				const previous = current[key];
				const next =
					typeof value === "function"
						? (value as (previous: typeof previous) => typeof previous)(previous)
						: value;
				return { ...current, [key]: next } as CallState;
			}),
		[sessionId, updateSession],
	);
	const actions = useMemo(
		() => ({
			setJoining: (value: SetStateAction<boolean>) => setField("joining", value),
			setInCall: (value: SetStateAction<boolean>) => setField("inCall", value),
			setMuted: (value: SetStateAction<boolean>) => setField("muted", value),
			setCameraOff: (value: SetStateAction<boolean>) => setField("cameraOff", value),
			setSharing: (value: SetStateAction<boolean>) => setField("sharing", value),
			setLocalMediaStream: (value: SetStateAction<MediaStream | null>) => setField("localMediaStream", value),
			setLocalDisplayStream: (value: SetStateAction<MediaStream | null>) => setField("localDisplayStream", value),
			setPeers: (value: SetStateAction<RealtimePeer[]>) => setField("peers", value),
			setServerMuted: (value: SetStateAction<boolean>) => setField("serverMuted", value),
			reset: () => resetSession(sessionId),
		}),
		[resetSession, sessionId, setField],
	);

	return { ...state, ...actions };
}

export function callSessionId(
	scope: "channel" | "direct",
	channelType: "text" | "voice",
	channelId: string,
) {
	return `${scope}:${channelType}:${channelId}`;
}
