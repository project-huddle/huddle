import { lazy, Suspense, useRef } from "react";
import type { ClipboardEvent } from "react";
import { ArrowUp, ImagePlus, Laugh, Reply, Search, X } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { resolveMediaUrl } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";
import { useMessageComposer } from "@/hooks/use-message-composer";

const EmojiPicker = lazy(() => import("./emoji-picker"));
const MAX_MESSAGE_LENGTH = 2000;

export function MessageComposer({ realtime }: { realtime: ReturnType<typeof useRealtime> }) {
	const { replyTo, setReplyTo, storeError, clearError } = useChatStore(useShallow((state) => ({ replyTo: state.replyTo, setReplyTo: state.setReplyTo, storeError: state.error, clearError: state.clearError })));
	const error = realtime.error ?? storeError;
	const onCancelReply = () => setReplyTo(null);
	const { draft, setDraft, media, setMedia, picker, setPicker, gifQuery, setGifQuery,
		gifs, gifLoading, uploading, fileRef, submit, uploadImage, searchGifs,
		mentionSuggestions, setCursorPosition, selectMention } = useMessageComposer(realtime);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chooseMention = (member: Parameters<typeof selectMention>[0]) => {
		const cursor = selectMention(member);
		if (cursor === null) return;
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(cursor, cursor);
		});
	};

	const insertEmoji = (emoji: string) => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const { selectionStart, selectionEnd } = textarea;
		const nextDraft = draft.slice(0, selectionStart) + emoji + draft.slice(selectionEnd);
		const fits = nextDraft.length <= MAX_MESSAGE_LENGTH;
		if (fits) setDraft(nextDraft);

		requestAnimationFrame(() => {
			textarea.focus();
			if (fits) {
				const cursor = selectionStart + emoji.length;
				textarea.setSelectionRange(cursor, cursor);
			} else {
				textarea.setSelectionRange(selectionStart, selectionEnd);
			}
		});
	};

	const pasteImage = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
		const image =
			Array.from(event.clipboardData.files).find((file) =>
				file.type.startsWith("image/"),
			) ??
			Array.from(event.clipboardData.items)
				.map((item) => item.kind === "file" ? item.getAsFile() : null)
				.find((file): file is File => Boolean(file?.type.startsWith("image/")));

		if (image) {
			event.preventDefault();
			await uploadImage(image);
			return;
		}

		const html = event.clipboardData.getData("text/html");
		if (!html) return;
		const imageSource = new DOMParser()
			.parseFromString(html, "text/html")
			.querySelector<HTMLImageElement>("img[src]")?.src;
		if (!imageSource || !/^https?:|^data:image\//.test(imageSource)) return;

		event.preventDefault();
		try {
			const response = await fetch(imageSource);
			if (!response.ok) throw new Error("Image fetch failed");
			const blob = await response.blob();
			await uploadImage(new File([blob], "imagem-colada", { type: blob.type }));
		} catch {
			realtime.setError("Não foi possível importar essa imagem. Use um screenshot ou 'Copiar imagem'.");
		}
	};

	return (
		<div className="shrink-0 px-4 pb-4 sm:px-7 sm:pb-6">
			<div className="relative mx-auto max-w-3xl">
				{error && (
					<div className="mb-2 flex items-center rounded-2xl border border-[#d76b5b]/25 bg-[#fff0ea] px-4 py-2.5 text-sm text-[#9c3f33]">
						<span className="flex-1">
							{error}
						</span>
						<button
							onClick={() => { realtime.setError(null); clearError(); }}
						>
							<X className="size-4" />
						</button>
					</div>
				)}

				{picker && (
					<div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md rounded-[24px] border border-(--line) bg-(--surface) p-3 shadow-[0_20px_50px_rgb(40_45_51_/_15%)]">
						<div className="mb-3 flex items-center justify-between px-1">
							<strong className="text-sm">
								{picker === "emoji"
									? "Escolha um emoji"
									: "Buscar GIF"}
							</strong>
							<button onClick={() => setPicker(null)}>
								<X className="size-4" />
							</button>
						</div>
						{picker === "emoji" ? (
							<Suspense fallback={<p role="status" className="p-4 text-sm">Carregando emojis...</p>}>
								<EmojiPicker onSelect={insertEmoji} />
							</Suspense>
						) : (
							<>
								<form
									onSubmit={searchGifs}
									className="mb-3 flex gap-2"
								>
									<div className="flex flex-1 items-center gap-2 rounded-xl bg-(--canvas) px-3">
										<Search className="size-4" />
										<input
											value={gifQuery}
											onChange={(event) =>
												setGifQuery(
													event.target
														.value,
												)
											}
											placeholder="reação, festa, café..."
											className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
										/>
									</div>
									<button className="rounded-xl bg-(--solid) px-4 text-sm font-bold text-(--on-solid)">
										{gifLoading
											? "..."
											: "buscar"}
									</button>
								</form>
								<div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
									{gifs.map((gif) => (
										<button
											key={gif.id}
											onClick={() => {
												setMedia({
													url: gif.url,
													type: "gif",
													alt: gif.alt,
												});
												setPicker(null);
											}}
											className="overflow-hidden rounded-xl bg-(--panel)"
										>
											<img
												src={gif.previewUrl}
												alt={gif.alt}
												className="aspect-square size-full object-cover"
											/>
										</button>
									))}
								</div>
								{!gifs.length && (
									<p className="py-7 text-center text-xs text-(--muted-text)">
										Digite algo para procurar.
										Requer uma chave Tenor
										existente.
									</p>
								)}
							</>
						)}
					</div>
				)}

				{replyTo && (
					<div className="mb-2 flex items-center gap-2 rounded-2xl bg-(--surface) px-3 py-2 text-xs">
						<Reply className="size-3.5" /> Respondendo a
						uma mensagem{" "}
						<button
							onClick={() => onCancelReply()}
							className="ml-auto"
						>
							<X className="size-3.5" />
						</button>
					</div>
				)}
				{media && (
					<div className="mb-2 inline-flex items-center gap-3 rounded-2xl border border-(--ink)/10 bg-(--surface) p-2 pr-3">
						<img
							src={resolveMediaUrl(media.url)}
							alt={media.alt}
							className="size-14 rounded-xl object-cover"
						/>
						<span className="max-w-40 truncate text-xs font-medium">
							{media.alt}
						</span>
						<button
							onClick={() => setMedia(null)}
							className="grid size-7 place-items-center rounded-full bg-(--canvas)"
						>
							<X className="size-3.5" />
						</button>
					</div>
				)}

				<form
					onSubmit={submit}
					className="flex items-end gap-1 rounded-[24px] border border-(--ink)/15 bg-(--surface) p-2 shadow-[0_8px_30px_rgba(32,37,31,.08)]"
				>
					<input
						ref={fileRef}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="hidden"
						onChange={(event) =>
							void uploadImage(
								event.target.files?.[0],
							)
						}
					/>
					<button
						type="button"
						disabled={uploading}
						onClick={() => fileRef.current?.click()}
						className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-(--brand-soft) disabled:opacity-50"
						aria-label="Enviar imagem"
					>
						<ImagePlus className="size-5" />
					</button>
					<button
						type="button"
						onClick={() =>
							setPicker(
								picker === "emoji" ? null : "emoji",
							)
						}
						className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-(--brand-soft)"
						aria-label="Adicionar emoji"
					>
						<Laugh className="size-5" />
					</button>
					<button
						type="button"
						onClick={() =>
							setPicker(
								picker === "gif" ? null : "gif",
							)
						}
						className="hidden h-10 shrink-0 rounded-2xl px-2 text-xs font-black hover:bg-(--brand-soft) sm:block"
					>
						GIF
					</button>
					<div className="relative min-w-0 flex-1">
						{mentionSuggestions.length > 0 && (
							<div className="absolute bottom-full left-0 z-30 mb-2 w-full min-w-52 overflow-hidden rounded-2xl border border-(--line) bg-(--surface) p-1 shadow-[0_15px_35px_rgb(40_45_51_/_18%)]">
								<p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-(--muted-text)">
									Membros deste servidor
								</p>
								{mentionSuggestions.map((member) => (
									<button
										key={member.id}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => chooseMention(member)}
										className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm hover:bg-(--brand-soft)"
									>
										<span className="font-bold">{member.displayName}</span>
									</button>
								))}
							</div>
						)}
						<textarea
						ref={textareaRef}
						maxLength={MAX_MESSAGE_LENGTH}
						onPaste={(event) => void pasteImage(event)}
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH));
							setCursorPosition(event.target.selectionStart);
						}}
						onClick={(event) => setCursorPosition(event.currentTarget.selectionStart)}
						onKeyUp={(event) => setCursorPosition(event.currentTarget.selectionStart)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey && mentionSuggestions.length > 0) {
								event.preventDefault();
								chooseMention(mentionSuggestions[0]);
								return;
							}
							if (event.key === "Escape" && mentionSuggestions.length > 0) {
								event.preventDefault();
								setCursorPosition(0);
								return;
							}
							if (event.key === "Tab" && mentionSuggestions.length > 0) {
								event.preventDefault();
								chooseMention(mentionSuggestions[0]);
								return;
							}
							if (
								event.key === "Enter" &&
								!event.shiftKey
							) {
								event.preventDefault();
								event.currentTarget.form?.requestSubmit();
							}
						}}
						rows={1}
						placeholder={
							uploading
								? "enviando imagem..."
								: "escreva do seu jeito"
						}
						disabled={!realtime.connected}
						className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-(--muted-text)"
						/>
					</div>
					<button
						disabled={
							(!draft.trim() && !media) ||
							!realtime.connected
						}
						className="grid size-10 shrink-0 place-items-center rounded-2xl bg-(--solid) text-(--brand) transition hover:-translate-y-0.5 disabled:opacity-30"
						aria-label="Enviar"
					>
						<ArrowUp className="size-5" />
					</button>
				</form>
			</div>
		</div>
	);
}
