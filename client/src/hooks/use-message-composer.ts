import { searchGiphy } from "@/lib/giphy";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
	api,
	type GifResult,
	type HuddleMember,
	type MessageMedia,
} from "@/lib/api";
import {
	gifQuerySchema,
	imageUploadSchema,
	messageDraftSchema,
} from "@/schemas/chat-schema";
import { useAuthStore } from "@/stores/auth-store";

export type ComposerTransport = {
	connected: boolean;
	error: string | null;
	setError: (message: string | null) => void;
	sendMessage: (
		content: string,
		media: MessageMedia | null,
		replyTo: string | null,
	) => boolean | Promise<boolean>;
};

type ComposerContext = {
	replyTo?: string | null;
	onCancelReply?: () => void;
	members?: HuddleMember[];
};

export function useMessageComposer(
	realtime: ComposerTransport,
	{ replyTo = null, onCancelReply, members = [] }: ComposerContext = {},
) {
	const token = useAuthStore((state) => state.token) ?? "";
	const [sending, setSending] = useState(false);

	const [draft, setDraft] = useState("");
	const [cursorPosition, setCursorPosition] = useState(0);
	const [media, setMedia] = useState<MessageMedia | null>(null);
	const [picker, setPicker] = useState<"emoji" | "gif" | null>(null);
	const [gifQuery, setGifQuery] = useState("");
	const [gifs, setGifs] = useState<GifResult[]>([]);
	const [gifLoading, setGifLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const mentionContext = useMemo(() => {
		const beforeCursor = draft.slice(0, cursorPosition);
		const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);
		if (!match || match.index === undefined) return null;
		return { start: match.index + match[1].length, query: match[2] ?? "" };
	}, [cursorPosition, draft]);
	const mentionSuggestions = useMemo(() => {
		if (!mentionContext) return [];
		const query = mentionContext.query.toLocaleLowerCase();
		return members
			.filter((member) =>
				member.displayName.toLocaleLowerCase().startsWith(query),
			)
			.slice(0, 6);
	}, [members, mentionContext]);

	const selectMention = (member: HuddleMember) => {
		if (!mentionContext) return null;
		const mention = "@" + member.displayName + " ";
		const nextDraft =
			draft.slice(0, mentionContext.start) +
			mention +
			draft.slice(cursorPosition);
		setDraft(nextDraft.slice(0, 2000));
		const nextCursorPosition = mentionContext.start + mention.length;
		setCursorPosition(nextCursorPosition);
		return nextCursorPosition;
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const parsed = messageDraftSchema.safeParse(draft);
		if (!parsed.success) {
			realtime.setError(
				parsed.error.issues[0]?.message ?? "Mensagem inválida.",
			);
			return;
		}
		if (
			(!parsed.data && !media) ||
			!realtime.connected ||
			sending ||
			uploading
		)
			return;
		setSending(true);
		try {
			const sent = await realtime.sendMessage(
				parsed.data,
				media,
				replyTo,
			);
			if (!sent) return;
			setDraft("");
			setMedia(null);
			onCancelReply?.();
			setPicker(null);
		} catch (cause) {
			realtime.setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível enviar a mensagem.",
			);
		} finally {
			setSending(false);
		}
	};

	const uploadImage = async (file?: File) => {
		if (!file) return;
		const parsed = imageUploadSchema.safeParse(file);
		if (!parsed.success) {
			realtime.setError(
				parsed.error.issues[0]?.message ?? "Imagem inválida.",
			);
			return;
		}
		setUploading(true);
		realtime.setError(null);
		const form = new FormData();
		form.append("file", parsed.data);
		try {
			const result = await api<{ media: MessageMedia }>(
				"/uploads",
				{ method: "POST", body: form },
				token,
			);
			setMedia(result.media);
		} catch (cause) {
			realtime.setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível enviar a imagem.",
			);
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const searchGifs = async (event: FormEvent) => {
		event.preventDefault();
		const parsed = gifQuerySchema.safeParse(gifQuery);
		if (!parsed.success) {
			realtime.setError(
				parsed.error.issues[0]?.message ?? "Busca inválida.",
			);
			return;
		}
		setGifLoading(true);
		realtime.setError(null);
		try {
			const results = await searchGiphy(parsed.data, token);
			setGifs(results);
		} catch (cause) {
			realtime.setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível buscar GIFs.",
			);
		} finally {
			setGifLoading(false);
		}
	};

	return {
		draft,
		setDraft,
		media,
		setMedia,
		picker,
		setPicker,
		gifQuery,
		setGifQuery,
		gifs,
		gifLoading,
		uploading,
		fileRef,
		replyTo,
		sending,
		submit,
		uploadImage,
		searchGifs,
		mentionSuggestions,
		mentionContext,
		setCursorPosition,
		selectMention,
	};
}
