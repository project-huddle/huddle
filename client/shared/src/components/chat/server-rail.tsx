import {
	MessageCircle,
	Plus,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { BrandMark } from "@/components/brand-logo";
import { useChatStore } from "@/stores/chat-store";
import ServerButton from "./server-button";

export function ServerRail() {
	const {
		servers,
		serverId,
		creating,
		selectServer,
		openDialog,
		setSocialOpen,
	} = useChatStore(
		useShallow((state) => ({
			servers: state.servers,
			serverId: state.serverId,
			creating: state.creating,
			selectServer: state.setServerId,
			openDialog: state.openDialog,
			setSocialOpen: state.setSocialOpen,
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
			<BrandMark className="size-11" />

			<button
				type="button"
				onClick={handleOpenSocial}
				className="grid size-11 place-items-center rounded-[15px] bg-(--surface)/10 text-(--on-solid) hover:bg-(--brand) hover:text-(--ink)"
				aria-label="Amigos e mensagens privadas"
			>
				<MessageCircle className="size-5" />
			</button>

			{servers.map((server) => (
				<ServerButton
					key={server.id}
					id={server.id}
					name={server.name}
					active={server.id === serverId}
					onSelect={selectServer}
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
