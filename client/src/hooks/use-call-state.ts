import { useCallback, useMemo, useReducer } from "react";
import type { SetStateAction } from "react";

import type { RealtimePeer } from "@/types/realtime";

type CallState = {
	joining: boolean;
	inCall: boolean;
	muted: boolean;
	cameraOff: boolean;
	sharing: boolean;
	localMediaStream: MediaStream | null;
	localDisplayStream: MediaStream | null;
	peers: RealtimePeer[];
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
};

type Action = { [Key in keyof CallState]: { key: Key; value: SetStateAction<CallState[Key]> } }[keyof CallState];

function reducer(state: CallState, action: Action): CallState {
	const current = state[action.key];
	const value = typeof action.value === "function"
		? (action.value as (previous: typeof current) => typeof current)(current)
		: action.value;
	return { ...state, [action.key]: value };
}

export function useCallState() {
	const [state, dispatch] = useReducer(reducer, initialState);
	const setter = useCallback(<Key extends keyof CallState>(key: Key) =>
		(value: SetStateAction<CallState[Key]>) => dispatch({ key, value } as Action), []);

	const actions = useMemo(() => ({
		setJoining: setter("joining"),
		setInCall: setter("inCall"),
		setMuted: setter("muted"),
		setCameraOff: setter("cameraOff"),
		setSharing: setter("sharing"),
		setLocalMediaStream: setter("localMediaStream"),
		setLocalDisplayStream: setter("localDisplayStream"),
		setPeers: setter("peers"),
	}), [setter]);

	return { ...state, ...actions };
}
