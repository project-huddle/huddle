import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type User } from "@/lib/api";
import { directMessageSchema, friendIdentifierSchema } from "@/schemas/social-schema";
import type { DirectMessage, Friendship } from "@/types/social";
export function useSocialHub(token: string, open: boolean) {
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
			).then(({ messages: rows }) => setMessages(rows)),
		[token],
	);
	useEffect(() => {
		if (open) void loadFriends();
	}, [loadFriends, open]);
	const sendFriendRequest = useCallback(async (value: string) => {
		const identifier = friendIdentifierSchema.parse(value);
		await api(
			"/friends",
			{ method: "POST", body: JSON.stringify({ identifier }) },
			token,
		);
		setEmail("");
		setStatus("Solicitação enviada.");
		await loadFriends();
	}, [loadFriends, token]);
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
		const friend = new URLSearchParams(window.location.search).get("friend");
		if (!friend) return;
		window.history.replaceState({}, "", window.location.pathname);
		void sendFriendRequest(friend).catch((cause) =>
			setStatus(cause instanceof Error ? cause.message : "Falha ao adicionar amizade."),
		);
	}, [sendFriendRequest]);
	const accept = async (userId: string) => {
		await api(`/friends/${userId}`, { method: "PATCH" }, token);
		await loadFriends();
	};
	const openConversation = async (friend: User) => {
		setSelected(friend);
		await loadMessages(friend.id);
	};
	const send = async (event: FormEvent) => {
		event.preventDefault();
		if (!selected) return;
		const content = directMessageSchema.parse(draft);
		await api(
			"/direct-messages",
			{
				method: "POST",
				body: JSON.stringify({
					recipientId: selected.id,
					content,
				}),
			},
			token,
		);
		setDraft("");
		await loadMessages(selected.id);
	};
	const copyFriendLink = async () => {
		const { link } = await api<{ link: string }>("/friends/link", {}, token);
		await navigator.clipboard.writeText(new URL(link, window.location.origin).toString());
		setStatus("Link de amizade copiado.");
	};
	return { friendships, email, setEmail, selected, messages, draft, setDraft, status,
		addFriend, accept, openConversation, send, copyFriendLink };
}
