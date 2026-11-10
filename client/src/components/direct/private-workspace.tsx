import { ArrowLeft, Check, Copy, Menu, Settings, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { DirectConversation } from "./direct-conversation";
import { useSocialHub } from "@/hooks/use-social-hub";
import type { User } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";

type Props = {
	currentUser: User;
	token: string;
	open: boolean;
	callAction?: (user: User) => ReactNode;
};

export function PrivateWorkspace({
	currentUser,
	token,
	open,
	callAction,
}: Props) {
	const social = useSocialHub(token, open);
	const [showContacts, setShowContacts] = useState(true);
	const [search, setSearch] = useState("");
	const {
		friendships,
		email,
		setEmail,
		selected,
		status,
		addFriend,
		accept,
		openConversation,
		copyFriendLink,
	} = social;
	const close = () => useChatStore.getState().setSocialOpen(false);
	const accepted = friendships.filter(
		(friendship) => friendship.status === "accepted",
	);
	const pending = friendships.filter(
		(friendship) => friendship.status === "pending",
	);

	return (
		<div
			className={`${open ? "flex" : "hidden"} min-h-0 min-w-0 lg:col-span-2`}
		>
			<aside
				className={`${showContacts || !selected ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-(--line) bg-(--panel) md:flex md:w-72`}
			>
				<header className="flex h-19 shrink-0 items-center gap-2 border-b border-(--line) px-4">
					<button
						type="button"
						onClick={() =>
							useChatStore.getState().setMobileNavOpen(true)
						}
						aria-label="Abrir navegação"
						className="p-2 lg:hidden"
					>
						<Menu className="size-5" />
					</button>
					<h1 className="flex-1 font-black">Mensagens privadas</h1>
					<button
						type="button"
						onClick={close}
						aria-label="Voltar ao servidor"
						className="rounded-lg p-2"
					>
						<ArrowLeft className="size-4" />
					</button>
				</header>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
					<input
						aria-label="Buscar contatos"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar contato"
						className="h-10 w-full rounded-xl border border-(--line) bg-(--surface) px-3 text-sm"
					/>
					<section>
						<h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-(--muted-text)">
							Conversas
						</h2>
						{accepted.length === 0 && (
							<p className="py-3 text-sm text-(--muted-text)">
								Adicione um amigo para conversar.
							</p>
						)}
						{accepted
							.filter(({ user }) =>
								user.displayName
									.toLocaleLowerCase()
									.includes(search.toLocaleLowerCase()),
							)
							.map(({ user }) => (
								<button
									key={user.id}
									type="button"
									onClick={() => {
										void openConversation(user);
										setShowContacts(false);
									}}
									aria-pressed={selected?.id === user.id}
									className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${selected?.id === user.id ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}
								>
									<UserAvatar
										user={user}
										className="size-9"
									/>
									<span className="truncate text-sm font-bold">
										{user.displayName}
									</span>
								</button>
							))}
					</section>
					<section className="space-y-3 border-t border-(--line) pt-4">
						<h2 className="text-xs font-bold uppercase tracking-wider text-(--muted-text)">
							Adicionar amigos
						</h2>
						<form onSubmit={addFriend} className="flex gap-2">
							<input
								required
								value={email}
								onChange={(event) =>
									setEmail(event.target.value)
								}
								placeholder="E-mail ou link de amizade"
								aria-label="E-mail ou link de amizade"
								className="h-10 min-w-0 flex-1 rounded-xl border border-(--line) bg-(--surface) px-3 text-sm"
							/>
							<button
								aria-label="Adicionar amigo"
								className="grid size-10 place-items-center rounded-xl bg-(--brand)"
							>
								<UserPlus className="size-4" />
							</button>
						</form>
						<button
							type="button"
							onClick={() => void copyFriendLink()}
							className="flex items-center gap-2 text-xs font-bold"
						>
							<Copy className="size-3.5" />
							Copiar meu link de amizade
						</button>
					</section>
					{pending.length > 0 && (
						<section className="space-y-3">
							<h2 className="text-xs font-bold uppercase text-(--muted-text)">
								Solicitações
							</h2>
							{pending.map((friendship) => (
								<div
									key={friendship.user.id}
									className="flex items-center gap-2 text-sm"
								>
									<span className="min-w-0 flex-1 truncate">
										{friendship.user.displayName}
										<small className="block text-(--muted-text)">
											{friendship.direction === "incoming"
												? "Quer adicionar você"
												: "Convite enviado"}
										</small>
									</span>
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
						</section>
					)}
					{status && (
						<p
							role="status"
							className="rounded-xl border border-(--line) p-3 text-sm"
						>
							{status}
						</p>
					)}
				</div>
				<footer className="flex items-center gap-3 border-t border-(--line) p-4">
					<UserAvatar user={currentUser} className="size-9" />
					<span className="min-w-0 flex-1 truncate text-sm font-bold">
						{currentUser.displayName}
					</span>
					<button
						type="button"
						onClick={() =>
							useChatStore.getState().setSettingsOpen(true)
						}
						aria-label="Configurações de perfil"
					>
						<Settings className="size-5" />
					</button>
				</footer>
			</aside>
			<div
				className={`${!showContacts && selected ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 md:flex`}
			>
				<DirectConversation
					currentUser={currentUser}
					social={social}
					onBack={() => setShowContacts(true)}
					callAction={selected ? callAction?.(selected) : null}
				/>
			</div>
		</div>
	);
}
