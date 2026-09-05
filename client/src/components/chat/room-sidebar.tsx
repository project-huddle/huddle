import { UserPlus } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { UserAvatar } from "@/components/user-avatar";
import type { HuddleMember, HuddleRole } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

function getRoleLabel(role: HuddleRole) {
	switch (role) {
		case "owner":
			return "proprietário";
		case "moderator":
			return "moderador";
		default:
			return "membro";
	}
}

export function RoomSidebar() {
	const user = useAuthStore((state) => state.user);
	const {
		members,
		servers,
		serverId,
		createInvite,
		changeMemberRole,
		removeMember,
	} = useChatStore(useShallow((state) => ({
		members: state.members,
		servers: state.servers,
		serverId: state.serverId,
		createInvite: state.createInvite,
		changeMemberRole: state.changeMemberRole,
		removeMember: state.removeMember,
	})));

	if (!user) return null;

	const activeServer = servers.find((server) => server.id === serverId);
	const canManageMembers = activeServer?.ownerId === user.id;

	const handleRemoveMember = (member: HuddleMember) => {
		const confirmed = window.confirm(
			`Remover ${member.displayName} do servidor?`,
		);

		if (confirmed) void removeMember(member);
	};

	return (
		<aside className="hidden min-h-0 flex-col bg-(--panel) lg:flex">
			<header className="flex h-19 shrink-0 items-center border-b border-(--ink)/10 px-6">
				<strong className="text-sm">Membros · {members.length}</strong>
				<button
					type="button"
					onClick={() => void createInvite()}
					className="ml-auto text-(--muted-text) hover:text-(--ink)"
					aria-label="Criar convite"
				>
					<UserPlus className="size-4" />
				</button>
			</header>

			<div className="flex-1 space-y-2 overflow-y-auto p-4">
				{members.map((member) => (
					<div
						key={member.id}
						className="group flex items-center gap-3 rounded-2xl p-2 hover:bg-(--surface)/70"
					>
						<UserAvatar user={member} className="size-9 rounded-xl" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold">
								{member.displayName}
							</p>
							<p className="text-[10px] text-(--muted-text)">
								{getRoleLabel(member.role)}
							</p>
						</div>

						{canManageMembers && !member.isOwner && (
							<div className="hidden gap-1 group-hover:flex group-focus-within:flex">
								<button
									type="button"
									onClick={() => void changeMemberRole(member)}
									className="rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-(--canvas)"
									title="Alternar moderador"
								>
									{member.role === "moderator" ? "membro" : "mod"}
								</button>
								<button
									type="button"
									onClick={() => handleRemoveMember(member)}
									className="rounded-lg px-2 py-1 text-[10px] font-bold text-[#b54e42] hover:bg-[#fff0ea]"
									title="Remover membro"
								>
									×
								</button>
							</div>
						)}
					</div>
				))}
			</div>
		</aside>
	);
}
