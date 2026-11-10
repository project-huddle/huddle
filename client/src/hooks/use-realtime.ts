import { useCallDevices } from "@/hooks/use-call-devices";
import { useScreenSharing } from "@/hooks/use-screen-sharing";
import { receivePeerTrack } from "@/lib/peer-media";
import { useCallback, useRef, useState } from "react";

import {
	type ChatMessage,
	type MessageMedia,
	type User,
	type HuddleChannel,
} from "@/lib/api";
import { useCallState } from "@/hooks/use-call-state";
import type { CallLifecycle, RealtimePeer as Peer } from "@/types/realtime";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { mediaErrorMessage, rtcConfig } from "@/lib/realtime";
import { useAuthStore } from "@/stores/auth-store";
import {
	readMediaDevicePreferences,
	writeMediaDevicePreferences,
} from "@/lib/media-devices";
import { unlockCallSounds } from "@/lib/call-sounds";

export function useRealtime(
	token: string,
	channelId: string,
	channelType: HuddleChannel["type"] = "text",
	scope: "channel" | "direct" = "channel",
) {
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
	} = useCallState();
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

	const updatePeer = useCallback(
		(userId: string, changes: Partial<Peer>) => {
			const user = peerUsers.current.get(userId);
			if (!user) return;
			setPeers((items) => {
				const found = items.some((item) => item.user.id === userId);
				return found
					? items.map((item) =>
							item.user.id === userId
								? { ...item, ...changes }
								: item,
						)
					: [
							...items,
							{
								user,
								audioStream: null,
								cameraStream: null,
								screenStream: null,
								screenAudioStream: null,
								sharing: false,
								muted: false,
								serverMuted: false,
								speaking: false,
								...changes,
							},
						];
			});
		},
		[setPeers],
	);

	const flushCandidates = useCallback(
		async (userId: string, pc: RTCPeerConnection) => {
			const candidates = pendingCandidates.current.get(userId) ?? [];
			pendingCandidates.current.delete(userId);
			for (const candidate of candidates)
				await pc.addIceCandidate(candidate);
		},
		[],
	);

	const createPeer = useCallback(
		(userId: string) => {
			const previous = connections.current.get(userId);
			if (previous) {
				previous.onconnectionstatechange = null;
				previous.close();
			}
			const recoveryTimer = recoveryTimers.current.get(userId);
			if (recoveryTimer) clearTimeout(recoveryTimer);
			recoveryTimers.current.delete(userId);
			recoveryAttempts.current.delete(userId);
			const pc = new RTCPeerConnection(rtcConfig);
			connections.current.set(userId, pc);
			localStream.current
				?.getAudioTracks()
				.forEach((track) => pc.addTrack(track, localStream.current!));
			localStream.current
				?.getVideoTracks()
				.forEach((track) => pc.addTrack(track, localStream.current!));
			const screen = displayStream.current;
			if (screen) {
				for (const track of screen.getTracks())
					pc.addTrack(track, screen);
			}

			pc.onicecandidate = ({ candidate }) => {
				if (candidate)
					send({
						type: "ice_candidate",
						targetUserId: userId,
						candidate: candidate.toJSON(),
					});
			};
			pc.ontrack = (event) =>
				receivePeerTrack(
					event,
					remoteSharing.current.get(userId),
					(changes) => updatePeer(userId, changes),
				);

			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "connected") {
					const recoveryTimer = recoveryTimers.current.get(userId);
					if (recoveryTimer) clearTimeout(recoveryTimer);
					recoveryTimers.current.delete(userId);
					recoveryAttempts.current.delete(userId);
					setError(null);
					return;
				}
				if (["failed", "disconnected"].includes(pc.connectionState)) {
					if (recoveryTimers.current.has(userId)) return;
					const attempt = recoveryAttempts.current.get(userId) ?? 0;
					if (attempt >= 3) {
						setError(
							"A conexão de mídia falhou. Verifique a rede ou configure um servidor TURN.",
						);
						return;
					}
					recoveryAttempts.current.set(userId, attempt + 1);
					const delay = 1_000 * 2 ** attempt;
					recoveryTimers.current.set(
						userId,
						setTimeout(async () => {
							recoveryTimers.current.delete(userId);
							if (
								callLifecycle.current !== "active" ||
								connections.current.get(userId) !== pc
							)
								return;
							try {
								pc.restartIce();
								await pc.setLocalDescription(
									await pc.createOffer({ iceRestart: true }),
								);
								if (
									callLifecycle.current === "active" &&
									pc.localDescription
								)
									send({
										type: "webrtc_offer",
										targetUserId: userId,
										sdp: pc.localDescription,
									});
							} catch (cause) {
								console.warn(
									"Unable to restart media connection",
									cause,
								);
							}
						}, delay),
					);
				}
				if (["failed", "closed"].includes(pc.connectionState)) {
					updatePeer(userId, {
						audioStream: null,
						cameraStream: null,
						screenStream: null,
						sharing: false,
					});
				}
			};
			return pc;
		},
		[send, updatePeer],
	);

	const makeOffer = useCallback(
		async (userId: string, pc: RTCPeerConnection) => {
			if (callLifecycle.current !== "active") return;
			await pc.setLocalDescription(await pc.createOffer());
			if (callLifecycle.current !== "active") return;
			send({
				type: "webrtc_offer",
				targetUserId: userId,
				sdp: pc.localDescription,
			});
		},
		[send],
	);

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
		socketRef,
		peerUsers,
		displayStream,
		remoteSharing,
		connections,
		pendingCandidates,
		callLifecycle,
		closeCall,
		createPeer,
		flushCandidates,
		makeOffer,
		send,
		updatePeer,
		setMessages,
		setConnected,
		onChannelSubscribed: channelType === "voice" ? joinCall : undefined,
		onCallLeft: () => resolvePendingLeave.current?.(),
		currentUserId,
		setError,
		setPeers,
		setJoining,
		setInCall,
		setServerMuted,
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
