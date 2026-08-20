import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { useRealtime } from "@/hooks/use-realtime";
import { api, type GifResult, type MessageMedia } from "@/lib/api";
import { gifQuerySchema, imageUploadSchema, messageDraftSchema } from "@/schemas/chat-schema";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

export function useMessageComposer(realtime: ReturnType<typeof useRealtime>) {
	const token = useAuthStore((state) => state.token)!;
	const replyTo = useChatStore((state) => state.replyTo);
	const setReplyTo = useChatStore((state) => state.setReplyTo);
	const [draft, setDraft] = useState("");
	const [media, setMedia] = useState<MessageMedia | null>(null);
	const [picker, setPicker] = useState<"emoji" | "gif" | null>(null);
	const [gifQuery, setGifQuery] = useState("");
	const [gifs, setGifs] = useState<GifResult[]>([]);
	const [gifLoading, setGifLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = messageDraftSchema.safeParse(draft);
		if (!parsed.success) {
			realtime.setError(parsed.error.issues[0]?.message ?? "Mensagem inválida.");
			return;
		}
		if ((!parsed.data && !media) || !realtime.connected) return;
		realtime.sendMessage(parsed.data, media, replyTo);
		setDraft("");
		setMedia(null);
		setReplyTo(null);
		setPicker(null);
	};

	const uploadImage = async (file?: File) => {
		if (!file) return;
		const parsed = imageUploadSchema.safeParse(file);
		if (!parsed.success) {
			realtime.setError(parsed.error.issues[0]?.message ?? "Imagem inválida.");
			return;
		}
		setUploading(true);
		realtime.setError(null);
		const form = new FormData();
		form.append("file", parsed.data);
		try {
			const result = await api<{ media: MessageMedia }>("/uploads", { method: "POST", body: form }, token);
			setMedia(result.media);
		} catch (cause) {
			realtime.setError(cause instanceof Error ? cause.message : "Não foi possível enviar a imagem.");
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const searchGifs = async (event: FormEvent) => {
		event.preventDefault();
		const parsed = gifQuerySchema.safeParse(gifQuery);
		if (!parsed.success) {
			realtime.setError(parsed.error.issues[0]?.message ?? "Busca inválida.");
			return;
		}
		setGifLoading(true);
		realtime.setError(null);
		try {
			const result = await api<{ results: GifResult[] }>(`/gifs/search?q=${encodeURIComponent(parsed.data)}`, {}, token);
			setGifs(result.results);
		} catch (cause) {
			realtime.setError(cause instanceof Error ? cause.message : "Não foi possível buscar GIFs.");
		} finally {
			setGifLoading(false);
		}
	};

	return { draft, setDraft, media, setMedia, picker, setPicker, gifQuery, setGifQuery,
		gifs, gifLoading, uploading, fileRef, replyTo, setReplyTo, submit, uploadImage, searchGifs };
}
