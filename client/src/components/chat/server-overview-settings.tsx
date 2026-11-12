import { useState } from "react";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { resolveMediaUrl } from "@/lib/api";
import type { useServerSettings } from "@/hooks/use-server-settings";

export function ServerOverviewSettings({
	settings,
}: {
	settings: ReturnType<typeof useServerSettings>;
}) {
	const [pendingImage, setPendingImage] = useState<File | null>(null);
	const {
		server,
		members,
		name,
		setName,
		iconUrl,
		newOwnerId,
		setNewOwnerId,
		saving,
		setServerStatus,
		saveServer,
		uploadIcon,
		isOwner,
		transferOwnershipToMember,
		deleteCurrentServer,
	} = settings;
	return (
		<section className="space-y-5">
			<ImageCropDialog
				file={pendingImage}
				onClose={() => setPendingImage(null)}
				onConfirm={uploadIcon}
			/>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void saveServer();
				}}
				className="space-y-4 rounded-2xl border border-(--line) p-5"
			>
				<label className="block text-sm font-bold">
					Nome do servidor
					<input
						required
						minLength={2}
						maxLength={40}
						value={name}
						onChange={(event) => {
							setServerStatus(null);
							setName(event.target.value);
						}}
						className="mt-2 h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal"
					/>
				</label>
				<label className="block text-sm font-bold">
					Ícone
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						onChange={(event) => {
							setPendingImage(event.target.files?.[0] ?? null);
							event.target.value = "";
						}}
						className="mt-2 block w-full text-sm font-normal"
					/>
				</label>
				{iconUrl && (
					<img
						src={resolveMediaUrl(iconUrl)}
						alt="Ícone do servidor"
						className="size-16 rounded-2xl object-cover"
					/>
				)}
				<button
					type="submit"
					disabled={saving}
					className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50"
				>
					{saving ? "Salvando..." : "Salvar servidor"}
				</button>
			</form>
			{isOwner && (
				<div className="space-y-3 border-t border-(--line) pt-5">
					<div>
						<h3 className="text-sm font-black">
							Transferir propriedade
						</h3>
						<p className="mt-1 text-sm text-(--muted-text)">
							O novo proprietário precisa ser membro. Você
							continuará com os cargos e permissões que já possui.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<select
							value={newOwnerId}
							onChange={(event) =>
								setNewOwnerId(event.target.value)
							}
							className="h-10 min-w-48 flex-1 rounded-xl border border-(--line) bg-(--surface) px-3 text-sm"
						>
							<option value="">Selecione um membro</option>
							{members
								.filter(
									(member) => member.id !== server?.ownerId,
								)
								.map((member) => (
									<option key={member.id} value={member.id}>
										{member.displayName}
									</option>
								))}
						</select>
						<button
							type="button"
							disabled={!newOwnerId}
							onClick={() => void transferOwnershipToMember()}
							className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50"
						>
							Transferir
						</button>
					</div>
				</div>
			)}
			{isOwner && (
				<div className="space-y-3 rounded-xl border border-red-600/25 p-5">
					<div>
						<h3 className="text-sm font-black text-red-600">
							Zona de perigo
						</h3>
						<p className="mt-1 text-sm text-(--muted-text)">
							Excluir o servidor remove permanentemente seus
							canais, mensagens e membros.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void deleteCurrentServer()}
						className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
					>
						Excluir servidor
					</button>
				</div>
			)}
		</section>
	);
}
