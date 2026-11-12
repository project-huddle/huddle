import { Check, Copy, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { useSocialHub } from "@/hooks/use-social-hub";

type Props = {
	open: boolean;
	onClose: () => void;
	social: ReturnType<typeof useSocialHub>;
};

export function FriendManager({ open, onClose, social }: Props) {
	const {
		friendships,
		email,
		setEmail,
		status,
		addFriend,
		accept,
		copyFriendLink,
	} = social;
	const pending = friendships.filter(({ status }) => status === "pending");
	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Amigos"
			description="Adicione pelo nome de usuário único, como @maria."
		>
			<form onSubmit={addFriend} className="space-y-3">
				<label className="block text-sm font-bold">
					Nome de usuário ou link de amizade
					<input
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="@nome_de_usuario"
						className="mt-2 h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal"
					/>
				</label>
				<button className="flex items-center gap-2 rounded-xl bg-(--brand) px-4 py-3 text-sm font-bold">
					<UserPlus className="size-4" />
					Adicionar amigo
				</button>
			</form>
			<button
				type="button"
				onClick={() => void copyFriendLink()}
				className="mt-4 flex items-center gap-2 text-xs font-bold"
			>
				<Copy className="size-4" />
				Copiar meu link de amizade
			</button>
			{status && (
				<p
					role="status"
					className="mt-4 rounded-xl border border-(--line) p-3 text-sm"
				>
					{status}
				</p>
			)}
			<section className="mt-6 border-t border-(--line) pt-4">
				<h2 className="mb-3 text-sm font-bold">
					Solicitações · {pending.length}
				</h2>
				{pending.length === 0 && (
					<p className="text-sm text-(--muted-text)">
						Nenhuma solicitação pendente.
					</p>
				)}
				<div className="max-h-64 space-y-3 overflow-y-auto">
					{pending.map((friendship) => (
						<div
							key={friendship.user.id}
							className="flex items-center gap-2 rounded-xl bg-(--surface) p-3"
						>
							<div className="min-w-0 flex-1">
								<strong className="block truncate text-sm">
									{friendship.user.displayName}
								</strong>
								<span className="block truncate text-xs text-(--muted-text)">
									@{friendship.user.username} ·{" "}
									{friendship.direction === "incoming"
										? "Quer adicionar você"
										: "Convite enviado"}
								</span>
							</div>
							{friendship.direction === "incoming" && (
								<button
									type="button"
									onClick={() =>
										void accept(friendship.user.id)
									}
									aria-label={`Aceitar ${friendship.user.displayName}`}
									className="rounded-lg bg-(--brand) p-2"
								>
									<Check className="size-4" />
								</button>
							)}
						</div>
					))}
				</div>
			</section>
		</Modal>
	);
}
