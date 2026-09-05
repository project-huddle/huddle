import { ArrowUp, Camera, ImagePlus, Laugh, Mic, MonitorUp, PhoneCall, PhoneOff, Reply, Search, X } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { resolveMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";
import { useMessageComposer } from "@/hooks/use-message-composer";

const EMOJIS = ["😀", "😂", "🥹", "😍", "🤔", "😅", "🥳", "😎", "🤝", "👏", "❤️", "🔥", "✨", "🎉", "👍", "👀", "☕", "🌿", "🐸", "🚀"];

export function MessageComposer({ realtime }: { realtime: ReturnType<typeof useRealtime> }) {
	const { replyTo, setReplyTo, setCallRoomOpen, storeError, clearError } = useChatStore(useShallow((state) => ({ replyTo: state.replyTo, setReplyTo: state.setReplyTo, setCallRoomOpen: state.setCallRoomOpen, storeError: state.error, clearError: state.clearError })));
	const error = realtime.error ?? storeError;
	const onCancelReply = () => setReplyTo(null);
	const onOpenCall = () => setCallRoomOpen(true);
	const { draft, setDraft, media, setMedia, picker, setPicker, gifQuery, setGifQuery,
		gifs, gifLoading, uploading, fileRef, submit, uploadImage, searchGifs } = useMessageComposer(realtime);

	return (
<div className="shrink-0 px-4 pb-4 sm:px-7 sm:pb-6">
						<div className="relative mx-auto max-w-3xl">
							<div className="mb-2 flex items-center gap-2 lg:hidden">
								{!realtime.inCall ? (
									<button
										disabled={
											!realtime.connected ||
											realtime.joining
										}
										onClick={realtime.joinCall}
										className="rounded-full bg-[var(--solid)] px-4 py-2 text-xs font-bold text-[var(--on-solid)] disabled:opacity-50"
									>
										<PhoneCall className="mr-1.5 inline size-3.5" />
										{realtime.joining
											? "entrando..."
											: "entrar na chamada"}
									</button>
								) : (
									<>
										<button
											type="button"
											onClick={() =>
												onOpenCall()
											}
											className="mr-auto rounded-full bg-[var(--solid)] px-3 py-2 text-xs font-bold text-[var(--on-solid)]"
										>
											Abrir sala ·{" "}
											{realtime.peers.length + 1}
										</button>
										<button
											type="button"
											onClick={realtime.toggleMute}
											className={cn(
												"grid size-9 place-items-center rounded-full",
												realtime.muted
													? "bg-[#d76b5b] text-[var(--on-solid)]"
													: "bg-[var(--surface)]",
											)}
										>
											<Mic className="size-4" />
										</button>
										<button
											type="button"
											onClick={realtime.toggleCamera}
											className={cn(
												"grid size-9 place-items-center rounded-full",
												realtime.cameraOff
													? "bg-[#d76b5b] text-[var(--on-solid)]"
													: "bg-[var(--surface)]",
											)}
										>
											<Camera className="size-4" />
										</button>
										<button
											type="button"
											onClick={realtime.toggleShare}
											className={cn(
												"grid size-9 place-items-center rounded-full",
												realtime.sharing
													? "bg-[#8fb996]"
													: "bg-[var(--surface)]",
											)}
										>
											<MonitorUp className="size-4" />
										</button>
										<button
											type="button"
											onClick={realtime.leaveCall}
											className="grid size-9 place-items-center rounded-full bg-[#d76b5b] text-[var(--on-solid)]"
										>
											<PhoneOff className="size-4" />
										</button>
									</>
								)}
							</div>
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
								<div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md rounded-[24px] border border-[var(--ink)]/15 bg-[var(--surface)] p-3 shadow-2xl shadow-[var(--ink)]/15">
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
										<div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
											{EMOJIS.map((emoji) => (
												<button
													key={emoji}
													onClick={() => {
														setDraft(
															(value) =>
																value + emoji,
														);
														setPicker(null);
													}}
													className="grid aspect-square place-items-center rounded-xl text-2xl hover:bg-[var(--brand-soft)]"
												>
													{emoji}
												</button>
											))}
										</div>
									) : (
										<>
											<form
												onSubmit={searchGifs}
												className="mb-3 flex gap-2"
											>
												<div className="flex flex-1 items-center gap-2 rounded-xl bg-[var(--canvas)] px-3">
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
												<button className="rounded-xl bg-[var(--solid)] px-4 text-sm font-bold text-[var(--on-solid)]">
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
								<div className="mb-2 flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs">
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
								<div className="mb-2 inline-flex items-center gap-3 rounded-2xl border border-[var(--ink)]/10 bg-[var(--surface)] p-2 pr-3">
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
										className="grid size-7 place-items-center rounded-full bg-[var(--canvas)]"
									>
										<X className="size-3.5" />
									</button>
								</div>
							)}

							<form
								onSubmit={submit}
								className="flex items-end gap-1 rounded-[24px] border border-[var(--ink)]/15 bg-[var(--surface)] p-2 shadow-[0_8px_30px_rgba(32,37,31,.08)]"
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
									className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[var(--brand-soft)] disabled:opacity-50"
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
									className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[var(--brand-soft)]"
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
									className="hidden h-10 shrink-0 rounded-2xl px-2 text-xs font-black hover:bg-[var(--brand-soft)] sm:block"
								>
									GIF
								</button>
								<textarea
									value={draft}
									onChange={(event) =>
										setDraft(
											event.target.value.slice(0, 2000),
										)
									}
									onKeyDown={(event) => {
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
									className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-[var(--muted-text)]"
								/>
								<button
									disabled={
										(!draft.trim() && !media) ||
										!realtime.connected
									}
									className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--solid)] text-[var(--brand)] transition hover:-translate-y-0.5 disabled:opacity-30"
									aria-label="Enviar"
								>
									<ArrowUp className="size-5" />
								</button>
							</form>
						</div>
					</div>
	);
}
