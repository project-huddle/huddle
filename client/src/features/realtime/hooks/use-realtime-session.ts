import { useCallDevices } from "@/features/realtime/hooks/use-call-devices";
import { useScreenSharing } from "@/features/realtime/hooks/use-screen-sharing";
import { useRealtimeConnection } from "@/features/realtime/hooks/use-realtime-connection";
import { usePeerConnections } from "@/features/realtime/hooks/use-peer-connections";
import { mediaErrorMessage } from "@/features/realtime/lib/realtime";
import { callSessionId, useCallState } from "@/features/realtime/state/call-store";
import { useCallback, useRef, useState } from "react";

import {
	type ChatMessage,
	type MessageMedia,
	type User,
	type HuddleChannel,
} from "@/shared/api/api";
import type { CallLifecycle } from "@/features/realtime/types/realtime";
import { useAuthStore } from "@/features/auth/state/auth-store";
import {
	readMediaDevicePreferences,
	writeMediaDevicePreferences,
} from "@/shared/lib/media-devices";
import { unlockCallSounds } from "@/features/realtime/lib/call-sounds";

export function useRealtime(
	token: string,
	channelId: string,
	channelType: HuddleChannel["type"] = "text",
	scope: "channel" | "direct" = "channel",
) {
	const sessionId = callSessionId(scope, channelType, channelId);
	const currentUserId = useAuthStore((state) => state.user?.id ?? "");
	const currentUserDisplayName = useAuthStore(
		(state) => state.user?.displayName ?? "",
	);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const {
		joining,
		inCall,
		muted,
		cameraOff,
		sharing,
		localMediaStream,
		localDisplayStream,
		peers,
		setJoining,
		setInCall,
		setMuted,
		setCameraOff,
		setSharing,
		setLocalMediaStream,
		setLocalDisplayStream,
		setPeers,
		serverMuted,
		setServerMuted,
		reset: resetCallState,
	} = useCallState(sessionId);
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const connections = useRef(new Map<string, RTCPeerConnection>());
	const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());
	const peerUsers = useRef(new Map<string, User>());
	const localStream = useRef<MediaStream | null>(null);
	const displayStream = useRef<MediaStream | null>(null);
	const recoveryAttempts = useRef(new Map<string, number>());
	const recoveryTimers = useRef(
		new Map<string, ReturnType<typeof setTimeout>>(),
	);
	const remoteSharing = useRef(new Map<string, string>());
	const callLifecycle = useRef<CallLifecycle>("idle");
	const callAttempt = useRef(0);
	const pendingLeave = useRef<Promise<void> | null>(null);
	const resolvePendingLeave = useRef<(() => void) | null>(null);
	const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const joinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const joiningRef = useRef(false);
	const inCallRef = useRef(false);
	joiningRef.current = joining;
	inCallRef.current = inCall;

	const send = useCallback((event: object) => {
		if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
		socketRef.current.send(JSON.stringify(event));
		return true;
	}, []);
	const { createPeer, flushCandidates, makeOffer, removePeer, updatePeer } =
		usePeerConnections({
			token,
			send,
			callLifecycle,
			callAttempt,
			connections,
			pendingCandidates,
			peerUsers,
			localStream,
			displayStream,
			remoteSharing,
			recoveryAttempts,
			recoveryTimers,
			setError,
			setPeers,
		});

	const closeCall = useCallback(
		(notifyServer: boolean) => {
			if (joinTimeout.current) clearTimeout(joinTimeout.current);
			joinTimeout.current = null;
			joiningRef.current = false;
			inCallRef.current = false;
			callAttempt.current += 1;
			callLifecycle.current = "idle";
			if (notifyServer) send({ type: "leave_call" });
			connections.current.forEach((pc) => pc.close());
			connections.current.clear();
			recoveryTimers.current.forEach((timer) => clearTimeout(timer));
			recoveryTimers.current.clear();
			recoveryAttempts.current.clear();
			pendingCandidates.current.clear();
			peerUsers.current.clear();
			localStream.current?.getTracks().forEach((track) => track.stop());
			localStream.current = null;
			displayStream.current?.getTracks().forEach((track) => track.stop());
			displayStream.current = null;
			setLocalMediaStream(null);
			setLocalDisplayStream(null);
			setPeers([]);
			setJoining(false);
			setInCall(false);
			setSharing(false);
			setMuted(false);
			setServerMuted(false);
			setCameraOff(true);
			remoteSharing.current.clear();
		},
		[
			send,
			setCameraOff,
			setInCall,
			setJoining,
			setLocalDisplayStream,
			setLocalMediaStream,
			setMuted,
			setPeers,
			setServerMuted,
			setSharing,
		],
	);

	const joinCall = useCallback(async () => {
		if (
			joiningRef.current ||
			inCallRef.current ||
			callLifecycle.current !== "idle"
		)
			return;
		unlockCallSounds();
		setError(null);
		setCameraOff(true);
		setMuted(false);
		const attempt = callAttempt.current + 1;
		callAttempt.current = attempt;
		callLifecycle.current = "joining";
		joiningRef.current = true;
		setJoining(true);
		try {
			if (!navigator.mediaDevices?.getUserMedia)
				throw new DOMException(
					"Media devices unavailable",
					"NotSupportedError",
				);
			const audio = {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			};
			const preferences = readMediaDevicePreferences();
			let stream: MediaStream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: preferences.audioInputDeviceId
						? {
								...audio,
								deviceId: {
									exact: preferences.audioInputDeviceId,
								},
							}
						: audio,
					video: false,
				});
			} catch (cause) {
				if (
					preferences.audioInputDeviceId &&
					cause instanceof DOMException &&
					cause.name === "OverconstrainedError"
				) {
					writeMediaDevicePreferences({
						...preferences,
						audioInputDeviceId: null,
					});
					stream = await navigator.mediaDevices.getUserMedia({
						audio,
						video: false,
					});
				} else throw cause;
			}
			if (
				callAttempt.current !== attempt ||
				callLifecycle.current !== "joining"
			) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			localStream.current = stream;
			setLocalMediaStream(stream);
			if (!send({ type: "join_call", callId: `channel-${channelId}` })) {
				stream.getTracks().forEach((track) => track.stop());
				localStream.current = null;
				setLocalMediaStream(null);
				throw new Error("WebSocket is not connected");
			}
			joinTimeout.current = setTimeout(() => {
				if (callLifecycle.current !== "joining") return;
				closeCall(false);
				setError(
					"A chamada demorou para responder. Tente entrar novamente.",
				);
			}, 10_000);
		} catch (cause) {
			if (callAttempt.current !== attempt) return;
			callLifecycle.current = "idle";
			joiningRef.current = false;
			setJoining(false);
			setError(mediaErrorMessage(cause, "microphone"));
		}
	}, [
		channelId,
		closeCall,
		send,
		setCameraOff,
		setError,
		setJoining,
		setLocalMediaStream,
		setMuted,
	]);

	useRealtimeConnection({
		token,
		channelId,
		channelType,
		scope,
		currentUserDisplayName,
		muted,
		socketRef,
		peerUsers,
		displayStream,
		remoteSharing,
		connections,
		pendingCandidates,
		callLifecycle,
		closeCall,
		createPeer,
		removePeer,
		flushCandidates,
		makeOffer,
		send,
		updatePeer,
		setMessages,
		setConnected,
		onChannelSubscribed: channelType === "voice" ? joinCall : undefined,
		onCallLeft: () => resolvePendingLeave.current?.(),
		onCallJoined: () => {
			if (joinTimeout.current) clearTimeout(joinTimeout.current);
			joinTimeout.current = null;
		},
		currentUserId,
		setError,
		setPeers,
		setJoining,
		setInCall,
		setServerMuted,
		onCleanup: resetCallState,
	});

	const leaveCall = useCallback(() => {
		if (pendingLeave.current) return pendingLeave.current;
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			closeCall(false);
			return Promise.resolve();
		}

		const leavePromise = new Promise<void>((resolve) => {
			resolvePendingLeave.current = resolve;
			leaveTimeout.current = setTimeout(resolve, 2_000);
		});
		pendingLeave.current = leavePromise;
		if (!send({ type: "leave_call" })) resolvePendingLeave.current?.();

		return leavePromise.finally(() => {
			if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
			leaveTimeout.current = null;
			resolvePendingLeave.current = null;
			pendingLeave.current = null;
			closeCall(false);
		});
	}, [closeCall, send]);

	const toggleMute = () => {
		if (serverMuted) return;
		const next = !muted;
		localStream.current?.getAudioTracks().forEach((track) => {
			track.enabled = !next;
		});
		setMuted(next);
		send({ type: "participant_state", muted: next });
	};
	const muteParticipant = (userId: string, muted: boolean) =>
		send({ type: "participant_mute", targetUserId: userId, muted });
	const { changeDevice, toggleCamera } = useCallDevices({
		cameraOff,
		localStream,
		connections,
		makeOffer,
		setLocalMediaStream,
		setCameraOff,
		setError,
	});

	const { toggleShare } = useScreenSharing({
		sharing,
		displayStream,
		connections,
		callLifecycle,
		callAttempt,
		send,
		makeOffer,
		setSharing,
		setLocalDisplayStream,
		setError,
	});

	return {
		messages,
		connected,
		joining,
		inCall,
		muted,
		serverMuted,
		cameraOff,
		sharing,
		peers,
		error,
		setError,
		localMediaStream,
		localDisplayStream,
		sendMessage: (
			content: string,
			media: MessageMedia | null = null,
			replyToId: string | null = null,
		) =>
			send({
				type: "chat_message",
				channelId,
				content,
				media,
				replyToId,
			}),
		editMessage: (messageId: string, content: string) =>
			send({ type: "edit_message", messageId, content }),
		deleteMessage: (messageId: string) =>
			send({ type: "delete_message", messageId }),
		reactMessage: (messageId: string, emoji: string) =>
			send({ type: "react_message", messageId, emoji }),
		joinCall,
		leaveCall,
		toggleMute,
		muteParticipant,
		changeDevice,
		toggleCamera,
		toggleShare,
	};
}
