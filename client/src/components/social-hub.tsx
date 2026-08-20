import { Check, MessageCircle, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/user-avatar";
import type { User } from "@/lib/api";
import { useSocialHub } from "@/hooks/use-social-hub";


export function SocialHub({
	currentUser,
	token,
	open,
	onClose,
}: {
	currentUser: User;
	token: string;
	open: boolean;
	onClose: () => void;
}) {
	const { friendships, email, setEmail, selected, messages, draft, setDraft, status,
		addFriend, accept, openConversation, send } = useSocialHub(token, open);
	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Amigos e mensagens"
			description="Converse em privado apenas com amizades aceitas."
			wide
		>
			<div className="grid min-h-[60svh] gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="border-r border-[var(--line)] pr-4">
					<form onSubmit={addFriend} className="flex gap-2">
						<input
							type="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="E-mail da pessoa"
							className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
						/>
						<button
							className="grid size-10 place-items-center rounded-xl bg-[var(--solid)] text-[var(--on-solid)]"
							aria-label="Adicionar amigo"
						>
							<UserPlus className="size-4" />
						</button>
					</form>
					{status && (
						<p className="mt-2 text-xs text-[var(--muted-text)]">
							{status}
						</p>
					)}
					<div className="mt-5 space-y-2">
						{friendships.map((friendship) => (
							<div
								key={friendship.user.id}
								className="flex items-center gap-2 rounded-xl p-2 hover:bg-[var(--surface)]"
							>
								<UserAvatar
									user={friendship.user}
									className="size-9"
								/>
								<button
									type="button"
									onClick={() =>
										friendship.status === "accepted" &&
										void openConversation(friendship.user)
									}
									className="min-w-0 flex-1 text-left"
								>
									<span className="block truncate text-sm font-bold">
										{friendship.user.displayName}
									</span>
									<span className="text-xs text-[var(--muted-text)]">
										{friendship.status === "accepted"
											? "amigo"
											: friendship.direction ===
												  "incoming"
												? "quer adicionar você"
												: "convite enviado"}
									</span>
								</button>
								{friendship.status === "pending" &&
								friendship.direction === "incoming" ? (
									<button
										onClick={() =>
											void accept(friendship.user.id)
										}
										aria-label="Aceitar amizade"
									>
										<Check className="size-4" />
									</button>
								) : (
									<MessageCircle className="size-4 text-[var(--muted-text)]" />
								)}
							</div>
						))}
					</div>
				</aside>
				<section className="flex min-h-0 flex-col">
					{selected ? (
						<>
							<header className="flex items-center gap-3 border-b border-[var(--line)] pb-3">
								<UserAvatar user={selected} />
								<strong>{selected.displayName}</strong>
							</header>
							<div className="flex-1 space-y-2 overflow-y-auto py-4">
								{messages.map((message) => (
									<div
										key={message.id}
										className={`max-w-[75%] rounded-2xl px-4 py-2 ${message.senderId === currentUser.id ? "ml-auto bg-[var(--solid)] text-[var(--on-solid)]" : "bg-[var(--surface)]"}`}
									>
										{message.content}
									</div>
								))}
							</div>
							<form onSubmit={send} className="flex gap-2">
								<input
									value={draft}
									onChange={(event) =>
										setDraft(
											event.target.value.slice(0, 2000),
										)
									}
									placeholder={`Mensagem para ${selected.displayName}`}
									className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4"
								/>
								<button className="rounded-xl bg-[var(--brand)] px-5 font-bold">
									Enviar
								</button>
							</form>
						</>
					) : (
						<div className="grid flex-1 place-items-center text-center text-[var(--muted-text)]">
							<div>
								<MessageCircle className="mx-auto size-10" />
								<p className="mt-3 font-bold">
									Escolha um amigo para conversar
								</p>
							</div>
						</div>
					)}
				</section>
			</div>
		</Modal>
	);
}
