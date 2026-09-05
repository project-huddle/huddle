import { Menu, MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { BrandMark } from "@/components/brand-logo";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageList } from "@/components/message-list";
import { ThemeToggle } from "@/components/theme";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";

export function ChatConversation({ realtime }: { realtime: ReturnType<typeof useRealtime> }) {
	const user = useAuthStore((state) => state.user);
	const token = useAuthStore((state) => state.token);
	const { servers, channels, serverId, channelId, setReplyTo: onReply, openDialog: openTextDialog, setMobileNavOpen, setSocialOpen } = useChatStore(useShallow((state) => ({ servers: state.servers, channels: state.channels, serverId: state.serverId, channelId: state.channelId, setReplyTo: state.setReplyTo, openDialog: state.openDialog, setMobileNavOpen: state.setMobileNavOpen, setSocialOpen: state.setSocialOpen })));
	const activeServer = servers.find(({ id }) => id === serverId);
	const activeChannel = channels.find(({ id }) => id === channelId);
	const isVoiceChannel = activeChannel?.type === "voice";
	const endRef = useRef<HTMLDivElement>(null);
	const onOpenNavigation = () => setMobileNavOpen(true);
	const onOpenSocial = () => setSocialOpen(true);
	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [realtime.messages]);
	if (!user || !token) return null;
	return (
		<section className="flex min-h-0 min-w-0 flex-col border-(--ink)/10 lg:border-r">
			<header className="flex h-19 shrink-0 items-center gap-3 border-b border-(--ink)/10 px-4 sm:px-7">
				<button
					onClick={() => onOpenNavigation()}
					className="grid size-10 shrink-0 place-items-center rounded-xl border border-(--ink)/10 bg-(--surface) lg:hidden"
					aria-label="Abrir navegação"
				>
					<Menu className="size-5" />
				</button>
				<div>
					<p className="text-2xl  font-mono">
						<span className="text-brand">&middot;{" "}</span>
						{activeChannel?.name ?? "..."}
					</p>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<span
						className={cn(
							"hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline",
							realtime.connected
								? "bg-(--brand)"
								: "bg-(--panel)",
						)}
					>
						{realtime.connected ? "ao vivo" : "conectando"}
					</span>
					<ThemeToggle />
					<button
						onClick={() => onOpenSocial()}
						className="grid size-9 place-items-center rounded-full border border-(--line)"
						aria-label="Amigos e mensagens"
					>
						<MessageCircle className="size-4" />
					</button>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7">
				<div className="mx-auto max-w-4xl">
					{!activeServer ? (
						<div className="grid min-h-[60svh] place-items-center text-center">
							<div className="max-w-md">
								<BrandMark className="mx-auto size-16" />
								<h1 className="mt-6 text-3xl font-black">
									Comece do seu jeito
								</h1>
								<p className="mt-2 text-(--muted-text)">
									Crie um servidor para sua
									comunidade, entre usando um convite
									ou converse com amigos em privado.
								</p>
								<div className="mt-6 flex flex-wrap justify-center gap-3">
									<button
										onClick={() =>
											openTextDialog(
												"create-server",
											)
										}
										className="rounded-xl bg-(--brand) px-5 py-3 font-bold"
									>
										Criar servidor
									</button>
									<button
										onClick={() =>
											openTextDialog(
												"join-server",
											)
										}
										className="rounded-xl border border-(--line) px-5 py-3 font-bold"
									>
										Usar convite
									</button>
									<button
										onClick={() =>
											onOpenSocial()
										}
										className="rounded-xl border border-(--line) px-5 py-3 font-bold"
									>
										Encontrar amigos
									</button>
								</div>
							</div>
						</div>
					) : isVoiceChannel ? (
						<div className="grid min-h-[60svh] place-items-center text-center">
							<div className="max-w-sm">
								<p className="text-4xl">🔊</p>
								<h1 className="mt-4 text-2xl font-black">{activeChannel.name}</h1>
								<p className="mt-2 text-(--muted-text)">
									Você entrou neste canal de voz. A sala de chamada abre automaticamente.
								</p>
							</div>
						</div>
					) : (
						<MessageList
							currentUserId={user.id}
							messages={realtime.messages}
							onReply={onReply}
							onEdit={realtime.editMessage}
							onDelete={(messageId) => {
								if (
									window.confirm(
										"Apagar esta mensagem?",
									)
								)
									realtime.deleteMessage(messageId);
							}}
							onReact={realtime.reactMessage}
							onReport={(messageId, targetUserId, reason) => {
								void api("/reports", { method: "POST", body: JSON.stringify({ serverId, messageId, targetUserId, reason }) }, token)
									.then(() => realtime.setError("Denúncia enviada para a moderação."))
									.catch((cause) => realtime.setError(cause instanceof Error ? cause.message : "Não foi possível enviar a denúncia."));
							}}
						/>
					)}
					<div ref={endRef} />
				</div>
			</div>

			{!isVoiceChannel && <MessageComposer realtime={realtime} />}
		</section>
	);
}
