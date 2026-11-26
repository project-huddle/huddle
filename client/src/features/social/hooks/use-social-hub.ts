import { useAuthStore } from "@/features/auth/state/auth-store";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type FormEvent,
} from "react";
import { api, type User, type MessageMedia } from "@/shared/api/api";
import {
	directMessageSchema,
	friendIdentifierSchema,
} from "@/features/social/schemas/social-schema";
import { useSocialEvents } from "@/features/social/hooks/use-social-events";
import type { DirectMessage, Friendship } from "@/features/social/types/social";
import { mergeDirectMessages } from "@/features/messages/lib/direct-message-history";

type MessagePage = { messages: DirectMessage[]; nextCursor: string | null };

export function useSocialHub(token: string, open: boolean) {
	const selectedId = useRef<string | null>(null);
	const conversationVersion = useRef(0);
	const earlierRequest = useRef<number | null>(null);
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(false);
	const [friendships, setFriendships] = useState<Friendship[]>([]);
	const [email, setEmail] = useState("");
	const [selected, setSelected] = useState<User | null>(null);
	const [messages, setMessages] = useState<DirectMessage[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loadingEarlier, setLoadingEarlier] = useState(false);
	const [draft, setDraft] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const loadFriends = useCallback(
		() =>
			api<{ friendships: Friendship[] }>("/friends", {}, token).then(
				({ friendships: rows }) => setFriendships(rows),
			),
		[token],
	);
	const loadMessages = useCallback(
		(
			userId: string,
			version = conversationVersion.current,
			resetCursor = false,
		) =>
			api<MessagePage>(
				`/direct-messages?userId=${userId}`,
				{},
				token,
			).then(({ messages: rows, nextCursor: cursor }) => {
				if (
					selectedId.current !== userId ||
					conversationVersion.current !== version
				)
					return;
				setMessages((current) => mergeDirectMessages(rows, current));
				if (resetCursor) setNextCursor(cursor ?? null);
			}),
		[token],
	);
	useEffect(() => {
		if (open)
			void loadFriends().catch((cause: unknown) =>
				setStatus(
					cause instanceof Error
						? cause.message
						: "Falha ao carregar amizades.",
				),
			);
	}, [loadFriends, open]);
	const sendFriendRequest = useCallback(
		async (value: string) => {
			const identifier = friendIdentifierSchema.parse(value);
			await api(
				"/friends",
				{ method: "POST", body: JSON.stringify({ identifier }) },
				token,
			);
			setEmail("");
			setStatus("Solicitação enviada.");
			await loadFriends();
		},
		[loadFriends, token],
	);
	const addFriend = async (event: FormEvent) => {
		event.preventDefault();
		try {
			await sendFriendRequest(email);
		} catch (cause) {
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao adicionar amizade.",
			);
		}
	};
	useEffect(() => {
		const friend = new URLSearchParams(window.location.search).get(
			"friend",
		);
		if (!friend) return;
		window.history.replaceState({}, "", window.location.pathname);
		void sendFriendRequest(friend).catch((cause) =>
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao adicionar amizade.",
			),
		);
	}, [sendFriendRequest]);
	const accept = async (userId: string) => {
		try {
			await api(`/friends/${userId}`, { method: "PATCH" }, token);
			await loadFriends();
		} catch (cause) {
			setStatus(
				cause instanceof Error
					? cause.message
					: "Não foi possível aceitar a amizade.",
			);
		}
	};
	const openConversation = async (friend: User) => {
		const version = ++conversationVersion.current;
		selectedId.current = friend.id;
		earlierRequest.current = null;
		setSelected(friend);
		setMessages([]);
		setNextCursor(null);
		setLoadingEarlier(false);
		setSending(false);
		setDraft("");
		setStatus(null);
		setLoading(true);
		try {
			await loadMessages(friend.id, version, true);
		} catch (cause) {
			if (conversationVersion.current !== version) return;
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao carregar a conversa.",
			);
		} finally {
			if (conversationVersion.current === version) setLoading(false);
		}
	};
	const loadEarlierMessages = async () => {
		const userId = selectedId.current;
		const version = conversationVersion.current;
		if (
			!userId ||
			!nextCursor ||
			loading ||
			earlierRequest.current === version
		)
			return;
		earlierRequest.current = version;
		setLoadingEarlier(true);
		try {
			const query = new URLSearchParams({ userId, cursor: nextCursor });
			const page = await api<MessagePage>(
				`/direct-messages?${query}`,
				{},
				token,
			);
			if (conversationVersion.current !== version) return;
			setMessages((current) =>
				mergeDirectMessages(page.messages, current),
			);
			setNextCursor(page.nextCursor);
		} catch (cause) {
			if (conversationVersion.current !== version) return;
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao carregar mensagens anteriores.",
			);
		} finally {
			if (conversationVersion.current === version) {
				earlierRequest.current = null;
				setLoadingEarlier(false);
			}
		}
	};
	const sendMessage = async (
		content: string,
		media: MessageMedia | null = null,
	): Promise<boolean> => {
		if (!selected || sending || loading) return false;
		const recipientId = selected.id;
		const version = conversationVersion.current;
		setSending(true);
		try {
			const { message } = await api<{ message: DirectMessage }>(
				"/direct-messages",
				{
					method: "POST",
					body: JSON.stringify({ recipientId, content, media }),
				},
				token,
			);
			if (conversationVersion.current === version) {
				setDraft("");
				setMessages((current) =>
					mergeDirectMessages([message], current),
				);
			}
			return true;
		} catch (cause) {
			if (conversationVersion.current !== version) return false;
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao enviar mensagem.",
			);
			return false;
		} finally {
			if (conversationVersion.current === version) setSending(false);
		}
	};
	const send = async (event: FormEvent) => {
		event.preventDefault();
		const input = directMessageSchema.safeParse(draft);
		if (!input.success) {
			setStatus("Escreva uma mensagem válida.");
			return;
		}
		await sendMessage(input.data);
	};

	useSocialEvents(token, (event) => {
		if (event.type === "profile_updated") {
			const user = event.user as User;
			setSelected((current) =>
				current?.id === user.id ? user : current,
			);
			if (user.id === useAuthStore.getState().user?.id)
				useAuthStore
					.getState()
					.updateUser({ ...useAuthStore.getState().user, ...user });
		}
		if (
			event.type === "ready" ||
			event.type === "friend_request" ||
			event.type === "friendship_changed" ||
			event.type === "profile_updated"
		) {
			void loadFriends().catch(() =>
				setStatus("Falha ao atualizar amizades."),
			);
			if (event.type === "ready" && selectedId.current) {
				const version = conversationVersion.current;
				void loadMessages(selectedId.current).catch(
					() =>
						conversationVersion.current === version &&
						setStatus("Falha ao atualizar a conversa."),
				);
			}
		}
		if (event.type === "direct_message") {
			const message = event.message as DirectMessage;
			if (
				message.senderId !== selectedId.current &&
				message.recipientId !== selectedId.current
			)
				return;
			setMessages((current) => mergeDirectMessages([message], current));
		}
	});

	const copyFriendLink = async () => {
		try {
			const { link } = await api<{ link: string }>(
				"/friends/link",
				{},
				token,
			);
			await navigator.clipboard.writeText(
				new URL(link, window.location.origin).toString(),
			);
			setStatus("Link de amizade copiado.");
		} catch (cause) {
			setStatus(
				cause instanceof Error
					? cause.message
					: "Não foi possível copiar o link.",
			);
		}
	};

	return {
		sending,
		loading,
		loadingEarlier,
		hasEarlierMessages: nextCursor !== null,
		loadEarlierMessages,
		friendships,
		email,
		setEmail,
		selected,
		messages,
		draft,
		setDraft,
		status,
		addFriend,
		accept,
		openConversation,
		setStatus,
		sendMessage,
		send,
		copyFriendLink,
	};
}
