import { Check, Hash, LogIn, Plus, Volume2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";

import { Modal } from "@/shared/ui/modal";
import type { HuddleChannel } from "@/shared/api/api";
import { useWorkspaceStore } from "@/features/workspace/state/workspace-store";
import type { WorkspaceDialog } from "@/features/workspace/types/workspace";


const dialogContent = {
	"create-server": {
		title: "Criar servidor",
		description: "Escolha um nome curto e fácil de reconhecer.",
		label: "Nome",
		placeholder: "Minha comunidade",
		maxLength: 60,
		submitLabel: "Criar",
	},
	"join-server": {
		title: "Entrar em um servidor",
		description: "Cole um código ou link de convite para participar.",
		label: "Código ou link do convite",
		placeholder: "https://huddle.app/invite/abc123",
		maxLength: 300,
		submitLabel: "Entrar",
	},
	"create-channel": {
		title: "Criar canal",
		description: "Escolha um nome curto e fácil de reconhecer.",
		label: "Nome",
		placeholder: "geral",
		maxLength: 60,
		submitLabel: "Criar",
	},
	"create-invite": {
		title: "Criar convite",
		description: "Defina por quantas horas este link ficará ativo.",
		label: "Duração em horas",
		placeholder: "2",
		maxLength: 8,
		submitLabel: "Criar convite",
	},
} satisfies Record<Exclude<WorkspaceDialog, "add-server">, {
	title: string;
	description: string;
	label: string;
	placeholder: string;
	maxLength: number;
	submitLabel: string;
}>;

export function ServerDialogs() {
	const [channelType, setChannelType] = useState<HuddleChannel["type"]>("text");
	const {
		dialog,
		value,
		creating,
		inviteUrl,
		error,
		onValueChange,
		onCloseDialog,
		openDialog,
		setInviteUrl,
		createServer,
		joinServer,
		createChannel,
		createInvite,
	} = useWorkspaceStore(useShallow((state) => ({
		dialog: state.dialog,
		value: state.dialogValue,
		creating: state.creating,
		inviteUrl: state.inviteUrl,
		error: state.error,
		onValueChange: state.setDialogValue,
		onCloseDialog: state.closeDialog,
		openDialog: state.openDialog,
		setInviteUrl: state.setInviteUrl,
		createServer: state.createServer,
		joinServer: state.joinServer,
		createChannel: state.createChannel,
		createInvite: state.createInvite,
	})));

	const textDialog = dialog && dialog !== "add-server" ? dialogContent[dialog] : null;
	const isCreatingChannel = dialog === "create-channel";
	const isCreatingInvite = dialog === "create-invite";

	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!inviteUrl) return;
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy invite URL:", error);
		}
	};

	useEffect(() => {
		if (dialog === "create-channel") setChannelType("text");
	}, [dialog]);

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();

		if (dialog === "create-server") void createServer(value);
		if (dialog === "join-server") void joinServer(inviteCodeFromInput(value));
		if (isCreatingChannel) void createChannel(value, channelType);
		if (isCreatingInvite) {
			const durationHours = Number(value);
			if (Number.isSafeInteger(durationHours) && durationHours >= 1)
				void createInvite(durationHours);
		}
	};

	return (
		<>
			<Modal
				open={dialog === "add-server"}
				onClose={onCloseDialog}
				title="Adicionar servidor"
				description="Crie uma comunidade ou entre com um convite."
			>
				<div className="grid gap-3 sm:grid-cols-2">
					<ServerAction
						icon={<Plus className="size-6" />}
						title="Criar servidor"
						description="Comece uma comunidade nova."
						onClick={() => openDialog("create-server")}
					/>
					<ServerAction
						icon={<LogIn className="size-6" />}
						title="Entrar em um servidor"
						description="Use um código ou link de convite."
						onClick={() => openDialog("join-server")}
					/>
				</div>
			</Modal>

			<Modal
				open={textDialog !== null}
				onClose={onCloseDialog}
				title={textDialog?.title ?? ""}
				description={textDialog?.description}
			>
				{textDialog && (
					<form onSubmit={onSubmit}>
						<label htmlFor="dialog-value" className="text-sm font-bold">
							{textDialog.label}
						</label>
						<input
							id="dialog-value"
							autoFocus
							value={value}
							onChange={(event) => onValueChange(event.target.value)}
							maxLength={textDialog.maxLength}
							placeholder={textDialog.placeholder}
							className="mt-2 h-12 w-full rounded-2xl border border-(--line) bg-(--surface) px-4 outline-none focus:ring-2 focus:ring-(--brand)"
						/>
						{isCreatingChannel && (
							<fieldset className="mt-5">
								<legend className="text-sm font-bold">Tipo do canal</legend>
								<div className="mt-2 grid grid-cols-2 gap-3">
									<ChannelTypeOption
										type="text"
										selected={channelType === "text"}
										icon={<Hash />}
										title="Texto"
										description="Mensagens e arquivos"
										onSelect={setChannelType}
									/>
									<ChannelTypeOption
										type="voice"
										selected={channelType === "voice"}
										icon={<Volume2 />}
										title="Voz"
										description="Áudio e vídeo ao vivo"
										onSelect={setChannelType}
									/>
								</div>
							</fieldset>
						)}
						{error && (
							<p className="mt-3 text-sm text-red-600" role="alert">
								{error}
							</p>
						)}
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={onCloseDialog}
								className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-(--surface)"
							>
								Cancelar
							</button>
							<button
								disabled={!value.trim() || creating}
								className="rounded-xl bg-(--solid) px-4 py-2.5 text-sm font-bold text-(--on-solid) disabled:opacity-40"
							>
								{creating
									? dialog === "join-server"
										? "Entrando..."
										: "Salvando..."
									: textDialog.submitLabel}
							</button>
						</div>
					</form>
				)}
			</Modal>

			<Modal
				open={inviteUrl !== null}
				onClose={() => setInviteUrl(null)}
				title="Convite criado"
				description="O link já foi copiado para a área de transferência."
			>
				<div className="break-all rounded-2xl bg-(--surface) p-4 text-center font-mono text-sm font-bold">
					{inviteUrl}
				</div>
				<button
					type="button"
					onClick={() => void handleCopy()}
					className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-xl bg-(--solid) px-4 py-3 text-sm font-bold text-(--on-solid) transition-colors hover:bg-(--brand)"
				>
					{copied ? <Check className="size-5" /> : "Copiar link"}
				</button>
			</Modal>
		</>
	);
}

type ServerActionProps = {
	icon: ReactNode;
	title: string;
	description: string;
	onClick: () => void;
};

function inviteCodeFromInput(value: string) {
	const trimmed = value.trim();
	const match = trimmed.match(/(?:^|\/)invite\/([^/?#]+)/);
	return match?.[1] ?? trimmed;
}

function ServerAction({ icon, title, description, onClick }: ServerActionProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-2xl border border-(--line) bg-(--surface) p-5 text-left transition hover:border-(--brand)"
		>
			<span className="mb-4 block text-(--brand)">{icon}</span>
			<strong className="block">{title}</strong>
			<span className="mt-1 block text-sm text-(--muted-text)">{description}</span>
		</button>
	);
}

type ChannelTypeOptionProps = {
	type: HuddleChannel["type"];
	selected: boolean;
	icon: ReactNode;
	title: string;
	description: string;
	onSelect: (type: HuddleChannel["type"]) => void;
};

function ChannelTypeOption({
	type,
	selected,
	icon,
	title,
	description,
	onSelect,
}: ChannelTypeOptionProps) {
	return (
		<label
			className={`relative cursor-pointer rounded-2xl border p-4 transition has-focus-visible:ring-2 has-focus-visible:ring-(--brand) ${selected
				? "border-(--brand) bg-(--brand)/15 shadow-sm"
				: "border-(--line) bg-(--surface) hover:border-(--muted-text)"
				}`}
		>
			<input
				type="radio"
				name="channel-type"
				value={type}
				checked={selected}
				onChange={() => onSelect(type)}
				className="peer sr-only"
			/>
			<span
				className={`mb-3 grid size-9 place-items-center rounded-xl [&>svg]:size-4 ${selected
					? "bg-(--brand) text-(--ink)"
					: "bg-(--canvas) text-(--muted-text)"
					}`}
			>
				{icon}
			</span>
			<strong className="block text-sm">{title}</strong>
			<span className="mt-0.5 block text-xs text-(--muted-text)">
				{description}
			</span>
			<span
				aria-hidden="true"
				className={`absolute right-3 top-3 size-2.5 rounded-full border ${selected
					? "border-(--brand) bg-(--brand)"
					: "border-(--muted-text)/50"
					}`}
			/>
		</label>
	);
}
