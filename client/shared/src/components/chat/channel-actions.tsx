import { useCallback, useRef, useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Modal } from "@/components/ui/modal";
import { api, type HuddleChannel } from "@/lib/api";
import { requireCredentials } from "@/lib/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

export function ChannelActions({ channelId }: { channelId: string }) {
	const userId = useAuthStore((state) => state.user?.id);
	const { channel, server, member } = useChatStore(
		useShallow((state) => ({
			channel: state.channels.find(
				(item) =>
					item.id === channelId && item.serverId === state.serverId,
			),
			server: state.servers.find((item) => item.id === state.serverId),
			member:
				state.membersServerId === state.serverId
					? state.members.find((item) => item.id === userId)
					: undefined,
		})),
	);
	const [action, setAction] = useState<"edit" | "delete" | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const pending = useRef(false);
	const canManage = Boolean(
		userId &&
		server &&
		(server.ownerId === userId || member?.role === "moderator"),
	);

	const close = useCallback(() => {
		if (!pending.current) setAction(null);
	}, []);

	if (!channel || !canManage) return null;
	const open = () => {
		setName(channel.name);
		setError(null);
		setAction("edit");
	};
	const submit = async (operation: "edit" | "delete") => {
		if (!action || pending.current) return;
		if (operation === "edit" && action === "delete") return;
		const normalizedName = name.trim().toLowerCase().replace(/\s+/g, "-");
		if (
			operation === "edit" &&
			!/^[a-z0-9_-]{2,32}$/.test(normalizedName)
		) {
			setError(
				"Use de 2 a 32 letras sem acentos, números, hífens ou sublinhados.",
			);
			return;
		}
		pending.current = true;
		setSaving(true);
		setError(null);
		try {
			const { token } = requireCredentials();
			const path = `/servers/${channel.serverId}/channels/${channel.id}`;
			if (operation === "edit") {
				const result = await api<{ channel: HuddleChannel }>(
					path,
					{
						method: "PATCH",
						body: JSON.stringify({ name: normalizedName }),
					},
					token,
				);
				useChatStore.setState((state) => ({
					channels: state.channels.map((item) =>
						item.id === channel.id ? result.channel : item,
					),
				}));
			} else {
				await api(path, { method: "DELETE" }, token);
				useChatStore.setState((state) => {
					const channels = state.channels.filter(
						(item) => item.id !== channel.id,
					);
					if (state.channelId !== channel.id) return { channels };
					const nextChannel = channels.find(
						(item) => item.type === "text",
					);
					return {
						channels,
						channelId: nextChannel?.id ?? channels[0]?.id ?? "",
						replyTo: null,
					};
				});
			}
			setAction(null);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível salvar a alteração.",
			);
		} finally {
			pending.current = false;
			setSaving(false);
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={open}
				aria-label={`Configurações do canal ${channel.name}`}
				className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-(--muted-text) transition-colors hover:bg-(--surface) hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--brand)"
			>
				<Settings className="size-4" />
			</button>
			<Modal
				open={action !== null}
				onClose={close}
				title="Configurações do canal"
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void submit("edit");
					}}
				>
					<label className="block text-sm font-bold">
						Nome do canal
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							maxLength={32}
							disabled={saving}
							className="mt-2 h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal outline-none focus:border-(--brand) focus:ring-2 focus:ring-(--brand)/25"
						/>
					</label>
					{error && (
						<p role="alert" className="mt-3 text-sm text-red-600">
							{error}
						</p>
					)}
					{action === "delete" && (
						<div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
							<p className="text-sm">
								Excluir <strong>{channel.name}</strong>? As
								mensagens serão removidas e as chamadas
								encerradas. Esta ação não pode ser desfeita.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button
									type="button"
									disabled={saving}
									onClick={() => setAction("edit")}
									className="rounded-lg px-3 py-2 text-sm font-medium"
								>
									Cancelar
								</button>
								<button
									type="button"
									disabled={saving}
									onClick={() => void submit("delete")}
									className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
								>
									Confirmar exclusão
								</button>
							</div>
						</div>
					)}
					<div className="mt-5 flex items-center justify-between gap-3 border-t border-(--line) pt-4">
						<button
							type="button"
							disabled={saving || action === "delete"}
							onClick={() => {
								setError(null);
								setAction("delete");
							}}
							className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-destructive hover:bg-destructive/75 transition-colors disabled:opacity-40 cursor-pointer"
						>
							<Trash2 className="size-4" /> Excluir canal
						</button>
						<button
							type="submit"
							disabled={
								saving || action === "delete" || !name.trim()
							}
							className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:opacity-40 hover:bg-(--brand) transition-colors cursor-pointer"
						>
							{saving ? "Salvando..." : "Salvar"}
						</button>
					</div>
				</form>
			</Modal>
		</>
	);
}
