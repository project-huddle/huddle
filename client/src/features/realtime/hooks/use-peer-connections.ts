import { useCallback, useRef, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";

import { fetchRTCConfiguration } from "@/features/realtime/lib/realtime";
import { receivePeerTrack } from "@/features/realtime/lib/peer-media";
import type { User } from "@/shared/api/api";
import type { CallLifecycle, RealtimePeer } from "@/features/realtime/types/realtime";

type Options = {
	token: string;
	send: (event: object) => boolean;
	callLifecycle: MutableRefObject<CallLifecycle>;
	callAttempt: MutableRefObject<number>;
	connections: MutableRefObject<Map<string, RTCPeerConnection>>;
	pendingCandidates: MutableRefObject<Map<string, RTCIceCandidateInit[]>>;
	peerUsers: MutableRefObject<Map<string, User>>;
	localStream: MutableRefObject<MediaStream | null>;
	displayStream: MutableRefObject<MediaStream | null>;
	remoteSharing: MutableRefObject<Map<string, string>>;
	recoveryAttempts: MutableRefObject<Map<string, number>>;
	recoveryTimers: MutableRefObject<
		Map<string, ReturnType<typeof setTimeout>>
	>;
	setError: (message: string | null) => void;
	setPeers: Dispatch<SetStateAction<RealtimePeer[]>>;
};

export function usePeerConnections(options: Options) {
	const {
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
	} = options;
	const pendingCreations = useRef(new Map<string, Promise<RTCPeerConnection>>());
	const peerGenerations = useRef(new Map<string, number>());
	const connectionStateHandler = useRef<
		((userId: string, peer: RTCPeerConnection) => void) | null
	>(null);
	const restartIceHandler = useRef<
		((userId: string, peer: RTCPeerConnection) => Promise<void>) | null
	>(null);
	const scheduleIceRestartHandler = useRef<
		((userId: string, peer: RTCPeerConnection) => void) | null
	>(null);

	const updatePeer = useCallback(
		(userId: string, changes: Partial<RealtimePeer>) => {
			const user = peerUsers.current.get(userId);
			if (!user) return;
			setPeers((items) => {
				const found = items.some((item) => item.user.id === userId);
				if (found) {
					return items.map((item) =>
						item.user.id === userId ? { ...item, ...changes } : item,
					);
				}
				return [
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
		[peerUsers, setPeers],
	);

	const flushCandidates = useCallback(
		async (userId: string, peer: RTCPeerConnection) => {
			const candidates = pendingCandidates.current.get(userId) ?? [];
			pendingCandidates.current.delete(userId);
			for (const candidate of candidates) await peer.addIceCandidate(candidate);
		},
		[pendingCandidates],
	);

	const createPeer = useCallback(
		async (userId: string) => {
			const attempt = callAttempt.current;
			const generation = peerGenerations.current.get(userId) ?? 0;
			const creationKey = `${attempt}:${userId}:${generation}`;
			const existing = connections.current.get(userId);
			if (existing) return existing;
			const pending = pendingCreations.current.get(creationKey);
			if (pending) return pending;

			const creation = (async () => {
				const configuration = await fetchRTCConfiguration(token);
				if (
					callAttempt.current !== attempt ||
					(peerGenerations.current.get(userId) ?? 0) !== generation ||
					callLifecycle.current !== "active"
				) {
					throw new DOMException(
						"A chamada foi encerrada antes de conectar o participante.",
						"AbortError",
					);
				}

				const peer = new RTCPeerConnection(configuration);
				try {
					const stream = localStream.current;
					if (stream) {
						for (const track of stream.getTracks())
							peer.addTrack(track, stream);
					}
					const screenStream = displayStream.current;
					if (screenStream) {
						for (const track of screenStream.getTracks())
							peer.addTrack(track, screenStream);
					}
				} catch (cause) {
					peer.close();
					throw cause;
				}

				peer.onicecandidate = ({ candidate }) => {
					if (!candidate) return;
					send({
						type: "ice_candidate",
						targetUserId: userId,
						candidate: candidate.toJSON(),
					});
				};
				peer.ontrack = (event) =>
					receivePeerTrack(
						event,
						remoteSharing.current.get(userId),
						(changes) => updatePeer(userId, changes),
					);
				peer.onconnectionstatechange = () =>
					connectionStateHandler.current?.(userId, peer);
				connections.current.set(userId, peer);
				return peer;
			})();

			pendingCreations.current.set(creationKey, creation);
			try {
				return await creation;
			} finally {
				if (pendingCreations.current.get(creationKey) === creation)
					pendingCreations.current.delete(creationKey);
			}
		},
		[
			callLifecycle,
			callAttempt,
			connections,
			displayStream,
			localStream,
			remoteSharing,
			send,
			token,
			updatePeer,
		],
	);

	const removePeer = useCallback(
		(userId: string) => {
			const generation = peerGenerations.current.get(userId) ?? 0;
			peerGenerations.current.set(userId, generation + 1);
			const peer = connections.current.get(userId);
			if (peer) {
				peer.onconnectionstatechange = null;
				peer.close();
				connections.current.delete(userId);
			}
			const timer = recoveryTimers.current.get(userId);
			if (timer) clearTimeout(timer);
			recoveryTimers.current.delete(userId);
			recoveryAttempts.current.delete(userId);
			pendingCandidates.current.delete(userId);
		},
		[connections, pendingCandidates, recoveryAttempts, recoveryTimers],
	);

	const handleConnectionState = useCallback(
		(userId: string, peer: RTCPeerConnection) => {
			if (peer.connectionState === "connected") {
				const timer = recoveryTimers.current.get(userId);
				if (timer) clearTimeout(timer);
				recoveryTimers.current.delete(userId);
				recoveryAttempts.current.delete(userId);
				setError(null);
				return;
			}

			if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
				scheduleIceRestartHandler.current?.(userId, peer);
			}
			if (peer.connectionState === "failed" || peer.connectionState === "closed") {
				updatePeer(userId, {
					audioStream: null,
					cameraStream: null,
					screenStream: null,
					sharing: false,
				});
			}
		},
		[recoveryAttempts, recoveryTimers, setError, updatePeer],
	);
	connectionStateHandler.current = handleConnectionState;

	const scheduleIceRestart = useCallback(
		(userId: string, peer: RTCPeerConnection) => {
			if (recoveryTimers.current.has(userId)) return;
			const attempt = recoveryAttempts.current.get(userId) ?? 0;
			if (attempt >= 3) {
				setError("A conexão de mídia falhou. Verifique a rede ou configure um servidor TURN.");
				return;
			}

			recoveryAttempts.current.set(userId, attempt + 1);
			const delay = 1_000 * 2 ** attempt;
			const timer = setTimeout(() => {
				recoveryTimers.current.delete(userId);
				void restartIceHandler.current?.(userId, peer);
			}, delay);
			recoveryTimers.current.set(userId, timer);
		},
		[recoveryAttempts, recoveryTimers, setError],
	);
	scheduleIceRestartHandler.current = scheduleIceRestart;

	const restartIce = useCallback(
		async (userId: string, peer: RTCPeerConnection) => {
			const attempt = callAttempt.current;
			if (
				callLifecycle.current !== "active" ||
				connections.current.get(userId) !== peer
			)
				return;

			try {
				const configuration = await fetchRTCConfiguration(token);
				if (
					callAttempt.current !== attempt ||
					callLifecycle.current !== "active" ||
					connections.current.get(userId) !== peer
				)
					return;
				peer.setConfiguration(configuration);
				peer.restartIce();
				await peer.setLocalDescription(
					await peer.createOffer({ iceRestart: true }),
				);
				if (
					callAttempt.current !== attempt ||
					callLifecycle.current !== "active" ||
					connections.current.get(userId) !== peer ||
					!peer.localDescription
				)
					return;
				send({
					type: "webrtc_offer",
					targetUserId: userId,
					sdp: peer.localDescription,
				});
			} catch (cause) {
				if (callAttempt.current !== attempt) return;
				console.warn("Unable to restart media connection", cause);
				setError("Não foi possível renovar a configuração ICE da chamada.");
			}
		},
		[callAttempt, callLifecycle, connections, send, setError, token],
	);
	restartIceHandler.current = restartIce;

	const makeOffer = useCallback(
		async (userId: string, peer: RTCPeerConnection) => {
			if (callLifecycle.current !== "active") return;
			await peer.setLocalDescription(await peer.createOffer());
			if (callLifecycle.current !== "active") return;
			send({
				type: "webrtc_offer",
				targetUserId: userId,
				sdp: peer.localDescription,
			});
		},
		[callLifecycle, send],
	);

	return { createPeer, flushCandidates, makeOffer, removePeer, updatePeer };
}
