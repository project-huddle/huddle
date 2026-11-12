import { LogOut, Settings } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

export function AccountControls({
	onSettingsOpened,
}: {
	onSettingsOpened?: () => void;
}) {
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);
	if (!user) return null;
	return (
		<footer className="flex shrink-0 items-center gap-2 border-t border-(--line) bg-(--panel) p-3">
			<UserAvatar user={user} className="size-9" />
			<div className="min-w-0 flex-1">
				<strong className="block truncate text-sm">
					{user.displayName}
				</strong>
				<span className="block truncate text-xs text-(--muted-text)">
					@{user.username}
				</span>
			</div>
			<button
				type="button"
				aria-label="Abrir configurações do perfil"
				title="Configurações"
				onClick={() => {
					useChatStore.getState().setSettingsOpen(true);
					onSettingsOpened?.();
				}}
				className="grid size-9 shrink-0 place-items-center rounded-xl hover:bg-(--surface)"
			>
				<Settings className="size-4" />
			</button>
			<button
				type="button"
				aria-label="Sair da conta"
				title="Sair da conta"
				onClick={logout}
				className="grid size-9 shrink-0 place-items-center rounded-xl text-red-600 hover:bg-red-600/10"
			>
				<LogOut className="size-4" />
			</button>
		</footer>
	);
}
