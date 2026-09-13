import { Flag, Pencil, Reply, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { resolveMediaUrl, type ChatMessage, type HuddleMember } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMessageDialog } from "@/hooks/use-message-dialog";
import { MessageAction } from "@/components/messages/message-action";
import { MessageDialogs } from "@/components/messages/message-dialogs";

type MessageListProps = {
	currentUserId: string;
	messages: ChatMessage[];
	members: HuddleMember[];
	onDelete: (messageId: string) => void;
	onEdit: (messageId: string, content: string) => void;
	onReact: (messageId: string, emoji: string) => void;
	onReport: (messageId: string, targetUserId: string, reason: string) => void;
	onReply: (messageId: string) => void;
};

export function MessageList({
	currentUserId,
	messages,
	members,
	onDelete,
	onEdit,
	onReact,
	onReply,
	onReport,
}: MessageListProps) {
	const { editing, editValue, reporting, reportReason,
		setEditing, setEditValue, setReporting, setReportReason } = useMessageDialog();
	const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
	const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
	}, []);

	const startEditing = (message: ChatMessage) => {
		setEditing(message);
		setEditValue(message.content);
	};

	const submitEdit = (event: FormEvent) => {
		event.preventDefault();
		if (!editing || !editValue.trim()) return;
		onEdit(editing.id, editValue.trim());
		setEditing(null);
	};
	const submitReport = (event: FormEvent) => {
		event.preventDefault();
		if (!reporting || reportReason.trim().length < 10) return;
		onReport(reporting.id, reporting.author.id, reportReason.trim());
		setReporting(null);
		setReportReason("");
	};
	const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const mentionPattern = members.length
		? new RegExp("(^|\\s)(" + [...members].sort((a, b) => b.displayName.length - a.displayName.length).map(({ displayName }) => "@" + escapeRegExp(displayName)).join("|") + ")(?=\\s|$|[.,!?])", "giu")
		: null;
	const renderContent = (content: string) => {
		if (!mentionPattern) return content;
		const parts: ReactNode[] = [];
		let lastIndex = 0;
		for (const match of content.matchAll(mentionPattern)) {
			const index = match.index ?? 0;
			parts.push(content.slice(lastIndex, index + (match[1]?.length ?? 0)));
			parts.push(
				<span key={index + "-" + match[2]} className="rounded bg-(--brand)/25 px-1 font-bold text-(--brand)">
					{match[2]}
				</span>,
			);
			lastIndex = index + match[0].length;
		}
		parts.push(content.slice(lastIndex));
		return parts;
	};
	const messagesById = new Map(messages.map((message) => [message.id, message]));
	const replyPreview = (messageId: string) => {
		const repliedMessage = messagesById.get(messageId);
		if (!repliedMessage) return "mensagem não disponível";
		if (repliedMessage.deletedAt) return "mensagem apagada";
		if (repliedMessage.content.trim()) {
			const preview = repliedMessage.content.replace(/\s+/g, " ").trim();
			return preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;
		}
		return repliedMessage.media ? "imagem" : "mensagem sem texto";
	};
	const highlightMessage = (messageId: string) => {
		setHighlightedMessageId(messageId);
		if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
		highlightTimeout.current = setTimeout(() => {
			setHighlightedMessageId(null);
			highlightTimeout.current = null;
		}, 3000);
	};

	return (
		<>
			<div className="space-y-3">
				{messages.map((message) => {
					const mine = message.author.id === currentUserId;

					return (
						<article
							key={message.id}
							id={`message-${message.id}`}
							className={cn(
								"scroll-mt-4 flex items-end gap-2",
								mine && "flex-row-reverse",
							)}
						>
							<UserAvatar
								user={message.author}
								className="size-8 rounded-[11px]"
							/>
							<div
								className={cn(
									"group relative max-w-[min(82%,620px)] rounded-[22px] border px-4 py-3 shadow-[0_2px_0_rgba(32,37,31,.08)]",
									mine
										? "rounded-br-md border-[var(--ink)] bg-[var(--solid)] text-[var(--on-solid)]"
										: "rounded-bl-md border-[var(--ink)]/10 bg-[var(--surface)]",
									highlightedMessageId === message.id &&
										"border-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,.28),0_2px_0_rgba(32,37,31,.08)]",
								)}
							>
								<div className="mb-1 flex items-center gap-2">
									<strong className="text-xs">
										{mine
											? "você"
											: message.author.displayName}
									</strong>
									<time
										className={cn(
											"text-[10px]",
											mine
												? "text-[var(--on-solid)]/50"
												: "text-[var(--muted-text)]",
										)}
									>
										{new Date(
											message.createdAt,
										).toLocaleTimeString("pt-BR", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</time>
								</div>
								{message.replyToId && (
									<a
										href={`#message-${message.replyToId}`}
										onClick={() => highlightMessage(message.replyToId!)}
										className="mb-2 block border-l-2 border-[var(--brand)] pl-2 text-left text-xs opacity-70 transition hover:opacity-100 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
										aria-label="Ir para a mensagem respondida"
									>
										<span className="block font-semibold">
											{messagesById.get(message.replyToId)?.author.displayName ?? "mensagem"}
										</span>
										<span className="block truncate">
											{replyPreview(message.replyToId)}
										</span>
									</a>
								)}
								{message.deletedAt ? (
									<p className="italic opacity-50">
										mensagem apagada
									</p>
								) : (
									message.content && (
										<p className="whitespace-pre-wrap wrap-break-word leading-6">
											{renderContent(message.content)}
											{message.editedAt && (
												<span className="ml-1 text-[10px] opacity-50">
													(editada)
												</span>
											)}
										</p>
									)
								)}
								{message.media && (
									<img
										src={resolveMediaUrl(message.media.url)}
										alt={message.media.alt}
										loading="lazy"
										className={cn(
											"mt-2 max-h-105 w-auto max-w-full rounded-xl object-contain",
											!message.content && "mt-0",
										)}
									/>
								)}
								{!message.deletedAt && (
									<div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
										<MessageAction
											label="Responder"
											onClick={() => onReply(message.id)}
										>
											<Reply />
										</MessageAction>
										{mine && (
											<>
												<MessageAction
													label="Editar"
													onClick={() =>
														startEditing(message)
													}
												>
													<Pencil />
												</MessageAction>
												<MessageAction
													label="Apagar"
													onClick={() =>
														onDelete(message.id)
													}
												>
													<Trash2 />
												</MessageAction>
											</>
										)}
									<button
											onClick={() =>
												onReact(message.id, "👍")
											}
											className="rounded px-1 text-xs hover:bg-[var(--surface)]/20"
											aria-label="Reagir com joinha"
										>
											👍
									</button>
									{!mine && (
										<MessageAction label="Denunciar" onClick={() => setReporting(message)}>
											<Flag />
										</MessageAction>
									)}
										<button
											onClick={() =>
												onReact(message.id, "❤️")
											}
											className="rounded px-1 text-xs hover:bg-[var(--surface)]/20"
											aria-label="Reagir com coração"
										>
											❤️
										</button>
									</div>
								)}
								{Object.keys(message.reactions).length > 0 && (
									<div className="mt-2 flex flex-wrap gap-1">
										{Object.entries(message.reactions).map(
											([emoji, count]) => (
												<button
													key={emoji}
													onClick={() =>
														onReact(
															message.id,
															emoji,
														)
													}
													className="rounded-full bg-[var(--brand)]/30 px-2 py-0.5 text-xs"
												>
													{emoji} {count}
												</button>
											),
										)}
									</div>
								)}
							</div>
						</article>
					);
				})}
			</div>

			<MessageDialogs
				editing={editing !== null}
				editValue={editValue}
				reporting={reporting !== null}
				reportReason={reportReason}
				onEditValue={setEditValue}
				onReportReason={setReportReason}
				onCloseEdit={() => setEditing(null)}
				onCloseReport={() => setReporting(null)}
				onSubmitEdit={submitEdit}
				onSubmitReport={submitReport}
			/>
		</>
	);
}
