import { useChatStore } from "@/stores/chat-store";
import { Modal } from "@/components/ui/modal";
import {
	useServerSettings,
	type ServerSettingsTab,
} from "@/hooks/use-server-settings";
import { ServerOverviewSettings } from "./server-overview-settings";
import { ServerRolesSettings } from "./server-roles-settings";
import { ServerMembersSettings } from "./server-members-settings";
import { ServerChannelsSettings } from "./server-channels-settings";

export function ServerSettings({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const settings = useServerSettings(open, onClose);
	const storeError = useChatStore((state) => state.error);
	const { server, tab, setTab, serverStatus, channelAccessStatus } = settings;
	let feedback = null;
	if (tab === "overview") feedback = serverStatus;
	if (tab === "channels") feedback = channelAccessStatus;
	if (!feedback && storeError)
		feedback = { type: "error" as const, message: storeError };

	return (
		<Modal
			wide
			open={open}
			onClose={onClose}
			title={`Configurações de ${server?.name ?? "servidor"}`}
			description="Gerencie identidade, cargos, membros e canais privados."
		>
			{feedback && (
				<div
					role={feedback.type === "error" ? "alert" : "status"}
					aria-live="polite"
					className={`mb-5 rounded-xl border px-4 py-3 text-sm font-bold ${feedback.type === "success" ? "border-green-600/25 bg-green-600/10 text-green-800" : "border-red-600/25 bg-red-600/10 text-red-700"}`}
				>
					{feedback.message}
				</div>
			)}
			<div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
				<nav
					aria-label="Seções das configurações do servidor"
					className="flex gap-2 overflow-x-auto border-b border-(--line) pb-3 md:flex-col md:border-b-0 md:border-r md:pr-4"
				>
					{(
						[
							"overview",
							"roles",
							"members",
							"channels",
						] as ServerSettingsTab[]
					).map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => setTab(item)}
							aria-current={tab === item ? "page" : undefined}
							className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm font-bold ${tab === item ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}
						>
							{
								(
									{
										overview: "Visão geral",
										roles: "Cargos",
										members: "Membros",
										channels: "Canais",
									} as Record<ServerSettingsTab, string>
								)[item]
							}
						</button>
					))}
				</nav>
				<div className="min-w-0">
					{tab === "overview" && (
						<ServerOverviewSettings settings={settings} />
					)}
					{tab === "roles" && (
						<ServerRolesSettings settings={settings} />
					)}
					{tab === "members" && (
						<ServerMembersSettings settings={settings} />
					)}
					{tab === "channels" && (
						<ServerChannelsSettings settings={settings} />
					)}
				</div>
			</div>
		</Modal>
	);
}
