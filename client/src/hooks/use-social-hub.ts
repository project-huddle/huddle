import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type FormEvent,
} from "react";
import { api, type User } from "@/lib/api";
import {
	directMessageSchema,
	friendIdentifierSchema,
} from "@/schemas/social-schema";
import { useSocialEvents } from "@/hooks/use-social-events";
import type { DirectMessage, Friendship } from "@/types/social";
export function useSocialHub(token: string, open: boolean) {
	const selectedId = useRef<string | null>(null);
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(false);
	const [friendships, setFriendships] = useState<Friendship[]>([]);
	const [email, setEmail] = useState("");
	const [selected, setSelected] = useState<User | null>(null);
	const [messages, setMessages] = useState<DirectMessage[]>([]);
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
		(userId: string) =>
			api<{ messages: DirectMessage[] }>(
				`/direct-messages?userId=${userId}`,
				{},
				token,
			).then(({ messages: rows }) => {
				if (selectedId.current !== userId) return;
				setMessages((current) => {
					const combined = new Map(
						[...rows, ...current].map((message) => [
							message.id,
							message,
						]),
					);
					return [...combined.values()].sort((a, b) =>
						a.createdAt.localeCompare(b.createdAt),
					);
				});
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
		await api(`/friends/${userId}`, { method: "PATCH" }, token);
		await loadFriends();
	};
	const openConversation = async (friend: User) => {
		selectedId.current = friend.id;
		setSelected(friend);
		setMessages([]);
		setDraft("");
		setStatus(null);
		setLoading(true);
		try {
			await loadMessages(friend.id);
		} catch (cause) {
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao carregar a conversa.",
			);
		} finally {
			if (selectedId.current === friend.id) setLoading(false);
		}
	};
	const send = async (event: FormEvent) => {
		event.preventDefault();
		if (!selected || sending || loading) return;
		const input = directMessageSchema.safeParse(draft);
		if (!input.success) {
			setStatus("Escreva uma mensagem de até 2000 caracteres.");
			return;
		}
		const recipientId = selected.id;
		setSending(true);
		try {
			const { message } = await api<{ message: DirectMessage }>(
				"/direct-messages",
				{
					method: "POST",
					body: JSON.stringify({ recipientId, content: input.data }),
				},
				token,
			);
			if (selectedId.current === recipientId) {
				setDraft("");
				setMessages((current) =>
					current.some(({ id }) => id === message.id)
						? current
						: [...current, message],
				);
			}
		} catch (cause) {
			setStatus(
				cause instanceof Error
					? cause.message
					: "Falha ao enviar mensagem.",
			);
		} finally {
			setSending(false);
		}
	};
	useSocialEvents(token, (event) => {
		if (
			event.type === "ready" ||
			event.type === "friend_request" ||
			event.type === "friendship_changed"
		) {
			void loadFriends().catch(() =>
				setStatus("Falha ao atualizar amizades."),
			);
			if (event.type === "ready" && selectedId.current) {
				void loadMessages(selectedId.current).catch(() =>
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
			setMessages((current) =>
				current.some(({ id }) => id === message.id)
					? current
					: [...current, message],
			);
		}
	});

	const copyFriendLink = async () => {
		const { link } = await api<{ link: string }>(
			"/friends/link",
			{},
			token,
		);
		await navigator.clipboard.writeText(
			new URL(link, window.location.origin).toString(),
		);
		setStatus("Link de amizade copiado.");
	};
	return {
		sending,
		loading,
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
		send,
		copyFriendLink,
	};
}
