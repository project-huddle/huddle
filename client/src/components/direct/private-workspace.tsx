import { ArrowLeft, Menu, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { AccountControls } from "@/components/chat/account-controls";
import { DirectConversation } from "./direct-conversation";
import { FriendManager } from "./friend-manager";
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
	const [friendsOpen, setFriendsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const { friendships, selected, openConversation } = social;
	const accepted = friendships.filter(({ status }) => status === "accepted");
	const pendingCount = friendships.filter(
		({ status, direction }) =>
			status === "pending" && direction === "incoming",
	).length;
	const filtered = accepted.filter(({ user }) =>
		`${user.displayName} ${user.username}`
			.toLocaleLowerCase()
			.includes(search.toLocaleLowerCase()),
	);
	return (
		<div
			className={`${open ? "flex" : "hidden"} min-h-0 min-w-0 lg:col-span-2`}
		>
			<aside
				className={`${showContacts || !selected ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-(--line) bg-(--panel) md:flex md:w-60`}
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
					<h1 className="min-w-0 flex-1 truncate text-sm font-bold">
						Mensagens privadas
					</h1>
					<button
						type="button"
						onClick={() =>
							useChatStore.getState().setSocialOpen(false)
						}
						aria-label="Voltar ao servidor"
						className="rounded-lg p-2"
					>
						<ArrowLeft className="size-4" />
					</button>
				</header>
				<div className="shrink-0 space-y-3 border-b border-(--line) p-3">
					<button
						type="button"
						onClick={() => setFriendsOpen(true)}
						className="flex w-full items-center gap-2 rounded-xl bg-(--brand)/20 px-3 py-3 text-sm font-bold"
					>
						<UserPlus className="size-4" />
						Adicionar amigos
						{pendingCount > 0 && (
							<span className="ml-auto rounded-full bg-(--brand) px-2 text-xs">
								{pendingCount}
							</span>
						)}
					</button>
					<input
						aria-label="Buscar contatos"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar conversa"
						className="h-10 w-full rounded-xl border border-(--line) bg-(--surface) px-3 text-sm"
					/>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-3">
					<h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-(--muted-text)">
						Conversas · {accepted.length}
					</h2>
					{filtered.length === 0 && (
						<p className="px-2 py-4 text-sm text-(--muted-text)">
							{search
								? "Nenhum contato encontrado."
								: "Adicione um amigo para começar."}
						</p>
					)}
					{filtered.map(({ user }) => (
						<button
							key={user.id}
							type="button"
							onClick={() => {
								void openConversation(user);
								setShowContacts(false);
							}}
							aria-label={user.displayName}
							aria-pressed={selected?.id === user.id}
							className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2 text-left ${selected?.id === user.id ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}
						>
							<UserAvatar user={user} className="size-9" />
							<span className="min-w-0">
								<strong className="block truncate text-sm">
									{user.displayName}
								</strong>
								<span className="block truncate text-xs text-(--muted-text)">
									@{user.username}
								</span>
							</span>
						</button>
					))}
				</div>
				<AccountControls />
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
			<FriendManager
				open={open && friendsOpen}
				onClose={() => setFriendsOpen(false)}
				social={social}
			/>
		</div>
	);
}
