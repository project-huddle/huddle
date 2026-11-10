import type { useServerSettings } from "@/hooks/use-server-settings";

export function ServerChannelsSettings({
	settings,
}: {
	settings: ReturnType<typeof useServerSettings>;
}) {
	const {
		channels,
		roles,
		channelId,
		channelRoles,
		setChannelRoles,
		saving,
		channelAccessStatus,
		setChannelAccessStatus,
		selectChannel,
		saveChannelAccess,
	} = settings;
	return (
		<section className="space-y-3">
			<select
				value={channelId}
				onChange={(event) => selectChannel(event.target.value)}
				className="h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3"
			>
				<option value="">Selecione um canal</option>
				{channels.map((channel) => (
					<option key={channel.id} value={channel.id}>
						{channel.type === "voice" ? "🔊" : "#"} {channel.name}
					</option>
				))}
			</select>
			{channelId && (
				<>
					<p className="text-sm text-(--muted-text)">
						Sem cargos selecionados, o canal é público.
					</p>
					<div className="space-y-2">
						{roles.map((role) => (
							<label key={role.id} className="flex gap-2 text-sm">
								<input
									type="checkbox"
									checked={channelRoles.includes(role.id)}
									onChange={(event) => {
										setChannelAccessStatus(null);
										setChannelRoles((current) =>
											event.target.checked
												? [...current, role.id]
												: current.filter(
														(id) => id !== role.id,
													),
										);
									}}
								/>
								{role.name}
							</label>
						))}
					</div>
					<button
						type="button"
						disabled={saving}
						onClick={() => void saveChannelAccess()}
						className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50"
					>
						{saving ? "Salvando..." : "Salvar acesso"}
					</button>
					{channelAccessStatus && (
						<p
							role={
								channelAccessStatus.type === "error"
									? "alert"
									: "status"
							}
							aria-live="polite"
							className={`text-sm ${channelAccessStatus.type === "success" ? "text-green-700" : "text-red-600"}`}
						>
							{channelAccessStatus.message}
						</p>
					)}
				</>
			)}
		</section>
	);
}
