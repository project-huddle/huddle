import { Flag, Pencil, Reply, Trash2 } from "lucide-react";
import type { FormEvent } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { resolveMediaUrl, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMessageDialog } from "@/hooks/use-message-dialog";
import { MessageAction } from "@/components/messages/message-action";
import { MessageDialogs } from "@/components/messages/message-dialogs";

type MessageListProps = {
	currentUserId: string;
	messages: ChatMessage[];
	onDelete: (messageId: string) => void;
	onEdit: (messageId: string, content: string) => void;
	onReact: (messageId: string, emoji: string) => void;
	onReport: (messageId: string, targetUserId: string, reason: string) => void;
	onReply: (messageId: string) => void;
};

export function MessageList({
	currentUserId,
	messages,
	onDelete,
	onEdit,
	onReact,
	onReply,
	onReport,
}: MessageListProps) {
	const { editing, editValue, reporting, reportReason,
		setEditing, setEditValue, setReporting, setReportReason } = useMessageDialog();

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

	return (
		<>
			<div className="space-y-3">
				{messages.map((message) => {
					const mine = message.author.id === currentUserId;

					return (
						<article
							key={message.id}
							className={cn(
								"flex items-end gap-2",
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
									<p className="mb-2 border-l-2 border-[var(--brand)] pl-2 text-xs opacity-60">
										respondendo a uma mensagem
									</p>
								)}
								{message.deletedAt ? (
									<p className="italic opacity-50">
										mensagem apagada
									</p>
								) : (
									message.content && (
										<p className="whitespace-pre-wrap wrap-break-word leading-6">
											{message.content}
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
