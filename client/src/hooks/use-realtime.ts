import { useCallback, useRef, useState } from "react";

import {
	type ChatMessage,
	type MessageMedia,
	type User,
	type HuddleChannel,
} from "@/lib/api";
import { useCallState } from "@/hooks/use-call-state";
import type {
	CallLifecycle,
	RealtimePeer as Peer,
} from "@/types/realtime";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { mediaErrorMessage, rtcConfig } from "@/lib/realtime";


export function useRealtime(token: string, channelId: string, channelType: HuddleChannel["type"] = "text") {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const { joining, inCall, muted, cameraOff, sharing, localMediaStream,
		localDisplayStream, peers, setJoining, setInCall, setMuted, setCameraOff,
		setSharing, setLocalMediaStream, setLocalDisplayStream, setPeers } = useCallState();
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const connections = useRef(new Map<string, RTCPeerConnection>());
	const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());
	const peerUsers = useRef(new Map<string, User>());
	const localStream = useRef<MediaStream | null>(null);
	const displayStream = useRef<MediaStream | null>(null);
	const displaySenders = useRef(new Map<string, RTCRtpSender>());
	const remoteSharing = useRef(new Set<string>());
	const callLifecycle = useRef<CallLifecycle>("idle");
	const callAttempt = useRef(0);

	const send = useCallback((event: object) => {
		if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
		socketRef.current.send(JSON.stringify(event));
		return true;
	}, []);

	const updatePeer = useCallback((userId: string, changes: Partial<Peer>) => {
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
							sharing: false,
							...changes,
						},
					];
		});
	}, [setPeers]);

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
			connections.current.get(userId)?.close();
			const pc = new RTCPeerConnection(rtcConfig);
			connections.current.set(userId, pc);
			localStream.current
				?.getAudioTracks()
				.forEach((track) => pc.addTrack(track, localStream.current!));
			localStream.current
				?.getVideoTracks()
				.forEach((track) => pc.addTrack(track, localStream.current!));
			displayStream.current?.getVideoTracks().forEach((track) => {
				displaySenders.current.set(
					userId,
					pc.addTrack(track, displayStream.current!),
				);
			});
			pc.onicecandidate = ({ candidate }) => {
				if (candidate)
					send({
						type: "ice_candidate",
						targetUserId: userId,
						candidate: candidate.toJSON(),
					});
			};
			pc.ontrack = ({ track, streams }) => {
				const stream = streams[0] ?? new MediaStream([track]);
				if (track.kind === "audio")
					updatePeer(userId, { audioStream: stream });
				if (track.kind === "video") {
					const screen = remoteSharing.current.has(userId);
					updatePeer(
						userId,
						screen
							? { screenStream: stream, sharing: true }
							: { cameraStream: stream },
					);
				}
				track.onended = () => {
					if (track.kind === "audio")
						updatePeer(userId, { audioStream: null });
					if (track.kind === "video") {
						const screen = remoteSharing.current.has(userId);
						updatePeer(
							userId,
							screen
								? { screenStream: null, sharing: false }
								: { cameraStream: null },
						);
					}
				};
			};
			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "failed")
					setError(
						"A conexão de mídia falhou. Verifique a rede ou configure um servidor TURN.",
					);
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
			callAttempt.current += 1;
			callLifecycle.current = "idle";
			if (notifyServer) send({ type: "leave_call" });
			connections.current.forEach((pc) => pc.close());
			connections.current.clear();
			pendingCandidates.current.clear();
			peerUsers.current.clear();
			localStream.current?.getTracks().forEach((track) => track.stop());
			localStream.current = null;
			displayStream.current?.getTracks().forEach((track) => track.stop());
			displayStream.current = null;
			displaySenders.current.clear();
			setLocalMediaStream(null);
			setLocalDisplayStream(null);
			setPeers([]);
			setJoining(false);
			setInCall(false);
			setSharing(false);
			setMuted(false);
			setCameraOff(true);
			remoteSharing.current.clear();
		},
		[send, setCameraOff, setInCall, setJoining, setLocalDisplayStream, setLocalMediaStream, setMuted, setPeers, setSharing],
	);

	useRealtimeConnection({
		token, channelId, channelType, socketRef, peerUsers, displayStream, remoteSharing,
		connections, pendingCandidates,
		callLifecycle,
		closeCall, createPeer, flushCandidates, makeOffer, send, updatePeer,
		setMessages, setConnected, setError, setPeers, setJoining, setInCall,
	});

	const joinCall = useCallback(async () => {
		if (joining || inCall) return;
		setError(null);
		const attempt = callAttempt.current + 1;
		callAttempt.current = attempt;
		callLifecycle.current = "joining";
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
			const stream = await navigator.mediaDevices.getUserMedia({
				audio,
				video: false,
			});
			if (callAttempt.current !== attempt || callLifecycle.current !== "joining") {
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
		} catch (cause) {
			if (callAttempt.current !== attempt) return;
			callLifecycle.current = "idle";
			setJoining(false);
			setError(mediaErrorMessage(cause, "microphone"));
		}
	}, [channelId, inCall, joining, send, setError, setJoining, setLocalMediaStream]);

	const leaveCall = useCallback(() => closeCall(true), [closeCall]);

	const toggleMute = () => {
		const next = !muted;
		localStream.current?.getAudioTracks().forEach((track) => {
			track.enabled = !next;
		});
		setMuted(next);
	};

	const toggleCamera = async () => {
		const stream = localStream.current;
		if (!stream) return;

		if (!cameraOff) {
			const videoTracks = stream.getVideoTracks();
			for (const [userId, pc] of connections.current) {
				for (const sender of pc.getSenders()) {
					if (sender.track && videoTracks.includes(sender.track)) pc.removeTrack(sender);
				}
				await makeOffer(userId, pc);
			}
			videoTracks.forEach((track) => {
				stream.removeTrack(track);
				track.stop();
			});
			setLocalMediaStream(new MediaStream(stream.getTracks()));
			setCameraOff(true);
			return;
		}

		setError(null);
		try {
			const cameraStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: "user",
				},
				audio: false,
			});
			const track = cameraStream.getVideoTracks()[0];
			if (!track) throw new DOMException("No camera track", "NotFoundError");
			stream.addTrack(track);
			for (const [userId, pc] of connections.current) {
				pc.addTrack(track, stream);
				await makeOffer(userId, pc);
			}
			setLocalMediaStream(new MediaStream(stream.getTracks()));
			setCameraOff(false);
		} catch (cause) {
			setError(mediaErrorMessage(cause, "camera"));
		}
	};

	const stopSharing = useCallback(async () => {
		const stream = displayStream.current;
		displayStream.current = null;
		if (!stream) return;
		stream.getTracks().forEach((track) => {
			track.onended = null;
			track.stop();
		});
		for (const [userId, pc] of connections.current) {
			const sender = displaySenders.current.get(userId);
			if (sender) pc.removeTrack(sender);
			displaySenders.current.delete(userId);
			send({ type: "screen_share", targetUserId: userId, active: false });
			await makeOffer(userId, pc).catch(() =>
				setError(
					"Não foi possível atualizar o compartilhamento de tela.",
				),
			);
		}
		setSharing(false);
		setLocalDisplayStream(null);
	}, [makeOffer, send, setLocalDisplayStream, setSharing]);

	const toggleShare = async () => {
		if (sharing) return stopSharing();
		setError(null);
		try {
			if (!navigator.mediaDevices?.getDisplayMedia)
				throw new DOMException(
					"Display media unavailable",
					"NotSupportedError",
				);
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: true,
			});
			displayStream.current = stream;
			setLocalDisplayStream(stream);
			const track = stream.getVideoTracks()[0];
			if (!track)
				throw new DOMException("No display track", "NotFoundError");
			track.onended = () => {
				void stopSharing();
			};
			for (const [userId, pc] of connections.current) {
				displaySenders.current.set(userId, pc.addTrack(track, stream));
				send({
					type: "screen_share",
					targetUserId: userId,
					active: true,
				});
				await makeOffer(userId, pc);
			}
			setSharing(true);
		} catch (cause) {
			displayStream.current?.getTracks().forEach((track) => track.stop());
			displayStream.current = null;
			setLocalDisplayStream(null);
			setSharing(false);
			setError(mediaErrorMessage(cause, "screen"));
		}
	};

	return {
		messages,
		connected,
		joining,
		inCall,
		muted,
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
		toggleCamera,
		toggleShare,
	};
}
