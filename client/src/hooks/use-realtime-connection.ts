import { useChatStore } from "@/stores/chat-store";
import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { api, websocketUrl, type ChatMessage, type HuddleChannel, type User } from "@/lib/api";
import type {
	CallLifecycle,
	RealtimePeer,
	SocketEvent,
} from "@/types/realtime";

type Options = {
	token: string; channelId: string; channelType: HuddleChannel["type"];
	socketRef: MutableRefObject<WebSocket | null>;
	peerUsers: MutableRefObject<Map<string, User>>;
	displayStream: MutableRefObject<MediaStream | null>;
	remoteSharing: MutableRefObject<Set<string>>;
	connections: MutableRefObject<Map<string, RTCPeerConnection>>;
	pendingCandidates: MutableRefObject<Map<string, RTCIceCandidateInit[]>>;
	callLifecycle: MutableRefObject<CallLifecycle>;
	closeCall: (notify: boolean) => void;
	createPeer: (userId: string) => RTCPeerConnection;
	flushCandidates: (userId: string, peer: RTCPeerConnection) => Promise<void>;
	makeOffer: (userId: string, peer: RTCPeerConnection) => Promise<void>;
	send: (event: object) => boolean;
	updatePeer: (userId: string, changes: Partial<RealtimePeer>) => void;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setConnected: Dispatch<SetStateAction<boolean>>;
	onChannelSubscribed?: () => void;
	setError: Dispatch<SetStateAction<string | null>>;
	setPeers: Dispatch<SetStateAction<RealtimePeer[]>>;
	setJoining: Dispatch<SetStateAction<boolean>>;
	setInCall: Dispatch<SetStateAction<boolean>>;
};

export function useRealtimeConnection(options: Options) {
	const subscribedHandlerRef = useRef(options.onChannelSubscribed);
	subscribedHandlerRef.current = options.onChannelSubscribed;
	const { token, channelId, channelType, socketRef, peerUsers, displayStream, remoteSharing, connections, pendingCandidates,
		callLifecycle,
		closeCall, createPeer, flushCandidates, makeOffer, send, updatePeer,
		setMessages, setConnected, setError, setPeers, setJoining, setInCall } = options;
	useEffect(() => {
		setConnected(false);
		if (!channelId) return;
		let alive = true;
		const messagesRequest = channelType === "voice"
			? Promise.resolve({ messages: [] as ChatMessage[] })
			: api<{ messages: ChatMessage[] }>(
				`/messages?channelId=${encodeURIComponent(channelId)}&limit=100`,
				{},
				token,
			);
		messagesRequest
			.then(({ messages }) => alive && setMessages(messages))
			.catch(
				(cause: unknown) =>
					alive &&
					setError(
						cause instanceof Error
							? cause.message
							: "Não foi possível carregar as mensagens.",
					),
			);

		let socket: WebSocket | null = null;
		const connect = async () => {
			const { ticket } = await api<{ ticket: string }>(
				"/auth/ws-ticket",
				{ method: "POST" },
				token,
			);
			if (!alive) return;
			socket = new WebSocket(websocketUrl(ticket));
			socketRef.current = socket;
			socket.onopen = () => {
				if (!alive || socketRef.current !== socket) return;
			};
			socket.onclose = () => {
				if (!alive || socketRef.current !== socket) return;
				setConnected(false);
				closeCall(false);
			};
			socket.onerror = () => {
				if (!alive || socketRef.current !== socket) return;
				setError("A conexão em tempo real foi interrompida.");
			};
			socket.onmessage = async ({ data }) => {
				if (!alive || socketRef.current !== socket) return;
				try {
					const event = JSON.parse(String(data)) as SocketEvent;
					const callEvent = [
						"call_joined",
						"peer_joined",
						"peer_left",
						"webrtc_offer",
						"webrtc_answer",
						"ice_candidate",
						"screen_share",
					].includes(event.type);
					const expectedCallId = `channel-${channelId}`;
					if (
						callEvent &&
						typeof event.callId === "string" &&
						event.callId !== expectedCallId
					)
						return;
					if (event.type === "chat_message") {
						const message = event.message as ChatMessage;
						setMessages((items) =>
							items.some(({ id }) => id === message.id)
								? items
								: [...items, message],
						);
					}
					if (event.type === "channel_subscribed") {
						if (event.channelId === channelId) {
							setConnected(true);
							subscribedHandlerRef.current?.();
						}
					}
					if (
						[
							"edit_message",
							"delete_message",
							"react_message",
						].includes(event.type)
					) {
						const message = event.message as ChatMessage;
						setMessages((items) =>
							items.map((item) =>
								item.id === message.id ? message : item,
							),
						);
					}
					if (event.type === "call_joined") {
						if (callLifecycle.current !== "joining") return;
						const users = Array.from(
							new Map(
								(event.peers as User[]).map((user) => [user.id, user]),
							).values(),
						);
						users.forEach((user) =>
							peerUsers.current.set(user.id, user),
						);
						setPeers(
							users.map((user) => ({
								user,
								audioStream: null,
								cameraStream: null,
								screenStream: null,
								sharing: false,
							})),
						);
						setJoining(false);
						setInCall(true);
						callLifecycle.current = "active";
					}
					if (event.type === "peer_joined") {
						if (callLifecycle.current !== "active") return;
						const user = event.user as User;
						if (!user?.id || user.id === peerUsers.current.get(user.id)?.id)
							return;
						peerUsers.current.set(user.id, user);
						updatePeer(user.id, {});
						const pc = createPeer(user.id);
						if (displayStream.current)
							send({
								type: "screen_share",
								targetUserId: user.id,
								active: true,
							});
						await makeOffer(user.id, pc);
					}
					if (event.type === "webrtc_offer") {
						if (callLifecycle.current !== "active") return;
						const userId = event.fromUserId as string;
						const pc =
							connections.current.get(userId) ??
							createPeer(userId);
						if (displayStream.current)
							send({
								type: "screen_share",
								targetUserId: userId,
								active: true,
							});
						await pc.setRemoteDescription(
							event.sdp as RTCSessionDescriptionInit,
						);
						if (callLifecycle.current !== "active") return;
						await flushCandidates(userId, pc);
						if (callLifecycle.current !== "active") return;
						await pc.setLocalDescription(await pc.createAnswer());
						send({
							type: "webrtc_answer",
							targetUserId: userId,
							sdp: pc.localDescription,
						});
					}
					if (event.type === "webrtc_answer") {
						if (callLifecycle.current !== "active") return;
						const userId = event.fromUserId as string;
						const pc = connections.current.get(userId);
						if (pc) {
							await pc.setRemoteDescription(
								event.sdp as RTCSessionDescriptionInit,
							);
							await flushCandidates(userId, pc);
						}
					}
					if (event.type === "ice_candidate") {
						if (callLifecycle.current !== "active") return;
						const userId = event.fromUserId as string;
						const pc = connections.current.get(userId);
						const candidate =
							event.candidate as RTCIceCandidateInit;
						if (pc?.remoteDescription)
							await pc.addIceCandidate(candidate);
						else
							pendingCandidates.current.set(userId, [
								...(pendingCandidates.current.get(userId) ??
									[]),
								candidate,
							]);
					}
					if (event.type === "screen_share") {
						if (callLifecycle.current !== "active") return;
						const userId = event.fromUserId as string;
						if (event.active === true)
							remoteSharing.current.add(userId);
						else remoteSharing.current.delete(userId);
						updatePeer(
							userId,
							event.active === true
								? { sharing: true }
								: { sharing: false, screenStream: null },
						);
					}
					if (event.type === "peer_left") {
						if (callLifecycle.current !== "active") return;
						const userId = event.userId as string;
						connections.current.get(userId)?.close();
						connections.current.delete(userId);
						remoteSharing.current.delete(userId);
						pendingCandidates.current.delete(userId);
						peerUsers.current.delete(userId);
						setPeers((items) =>
							items.filter((item) => item.user.id !== userId),
						);
					}
					if (event.type === "error") {
						if (callLifecycle.current !== "idle") closeCall(false);
						callLifecycle.current = "idle";
						setJoining(false);
						setError(
							String(event.message ?? "Erro de comunicação."),
						);
					}
					if (event.type === "call_replaced") {
						closeCall(false);
						setError("Você entrou em outra chamada.");
					}
					if (event.type === "access_revoked") {
						useChatStore.setState((state) => {
							if (state.channelId !== event.channelId) return state;
							return { channelId: "", replyTo: null };
						});
						setMessages([]);
						closeCall(false);
						void useChatStore.getState().loadChannels();
						setError(
							"Seu acesso a este canal foi removido. Atualize ou selecione outro servidor.",
						);
					}
				} catch (cause) {
					console.error("Realtime event failed", String(data), cause);
					setError("Falha ao processar um evento da chamada.");
				}
			};
			const subscribe = () =>
				socket?.readyState === WebSocket.OPEN &&
				socket.send(
					JSON.stringify({ type: "subscribe_channel", channelId }),
				);
			socket.addEventListener("open", subscribe);
		};
		void connect().catch((cause: unknown) => {
			if (alive)
				setError(
					cause instanceof Error
						? cause.message
						: "Não foi possível abrir a conexão em tempo real.",
				);
		});
		return () => {
			alive = false;
			setConnected(false);
			socket?.close();
			if (socketRef.current === socket) socketRef.current = null;
			closeCall(false);
		};
	}, [
		channelId,
		channelType,
		closeCall,
		createPeer,
		flushCandidates,
		makeOffer,
		send,
		token,
		updatePeer,
		setInCall,
		setJoining,
		setPeers,
		setConnected,
		setError,
		setMessages,
		connections,
		callLifecycle,
		displayStream,
		peerUsers,
		pendingCandidates,
		remoteSharing,
		socketRef,
	]);
}
