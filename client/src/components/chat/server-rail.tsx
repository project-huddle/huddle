import { Plus } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { BrandMark } from "@/components/brand-logo";
import { useChatStore } from "@/stores/chat-store";
import ServerButton from "./server-button";

export function ServerRail() {
	const {
		socialOpen,
		servers,
		serverId,
		creating,
		selectServer,
		openDialog,
		setSocialOpen,
		unreadByServer,
	} = useChatStore(
		useShallow((state) => ({
			socialOpen: state.socialOpen,
			servers: state.servers,
			serverId: state.serverId,
			creating: state.creating,
			selectServer: state.setServerId,
			openDialog: state.openDialog,
			setSocialOpen: state.setSocialOpen,
			unreadByServer: state.unreadByServer,
		})),
	);

	const handleOpenSocial = () => {
		setSocialOpen(true);
	};

	const handleAddServer = () => {
		openDialog("add-server");
	};

	return (
		<aside className="hidden flex-col items-center gap-3 border-r border-(--ink)/10 bg-(--solid) py-5 lg:flex">
			<button
				type="button"
				onClick={handleOpenSocial}
				className="grid size-11 place-items-center rounded-[15px] bg-(--surface)/10 text-(--on-solid) hover:bg-(--brand) hover:text-(--ink)"
				aria-pressed={socialOpen}
				aria-label="Amigos e mensagens privadas"
			>
				<BrandMark className="size-11" />
			</button>

			{servers.map((server) => (
				<ServerButton
					key={server.id}
					id={server.id}
					name={server.name}
					active={!socialOpen && server.id === serverId}
					onSelect={selectServer}
					unread={unreadByServer[server.id]}
				/>
			))}

			<button
				type="button"
				onClick={handleAddServer}
				disabled={creating}
				className="grid size-11 place-items-center rounded-[15px] bg-(--surface)/10 text-(--brand) hover:bg-(--surface)/20"
				aria-label="Adicionar servidor"
			>
				<Plus className="size-5" />
			</button>
		</aside>
	);
}
