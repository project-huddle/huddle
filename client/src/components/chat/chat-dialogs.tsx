import { Hash, Plus, Users, Volume2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";

import { Modal } from "@/components/ui/modal";
import type { HuddleChannel } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";
import type { ChatDialog } from "@/types/chat";

const dialogContent = {
	"create-server": {
		title: "Criar servidor",
		description: "Escolha um nome curto e fácil de reconhecer.",
		label: "Nome",
		placeholder: "Minha comunidade",
		maxLength: 60,
		submitLabel: "Criar",
	},
	"create-channel": {
		title: "Criar canal",
		description: "Escolha um nome curto e fácil de reconhecer.",
		label: "Nome",
		placeholder: "geral",
		maxLength: 60,
		submitLabel: "Criar",
	},
	"join-server": {
		title: "Entrar em um servidor",
		description: "Cole o código de convite que você recebeu.",
		label: "Código do convite",
		placeholder: "Ex.: ABC123",
		maxLength: 100,
		submitLabel: "Entrar",
	},
} satisfies Record<Exclude<ChatDialog, "add-server">, {
	title: string;
	description: string;
	label: string;
	placeholder: string;
	maxLength: number;
	submitLabel: string;
}>;

export function ChatDialogs() {
	const [channelType, setChannelType] = useState<HuddleChannel["type"]>("text");
	const {
		dialog,
		value,
		creating,
		inviteCode,
		onValueChange,
		onCloseDialog,
		openDialog,
		setInviteCode,
		createServer,
		createChannel,
		joinServer,
	} = useChatStore(useShallow((state) => ({
		dialog: state.dialog,
		value: state.dialogValue,
		creating: state.creating,
		inviteCode: state.inviteCode,
		onValueChange: state.setDialogValue,
		onCloseDialog: state.closeDialog,
		openDialog: state.openDialog,
		setInviteCode: state.setInviteCode,
		createServer: state.createServer,
		createChannel: state.createChannel,
		joinServer: state.joinServer,
	})));

	const textDialog = dialog && dialog !== "add-server" ? dialogContent[dialog] : null;
	const isCreatingChannel = dialog === "create-channel";

	useEffect(() => {
		if (dialog === "create-channel") setChannelType("text");
	}, [dialog]);

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();

		if (dialog === "create-server") void createServer(value);
		if (isCreatingChannel) void createChannel(value, channelType);
		if (dialog === "join-server") void joinServer(value);
	};

	return (
		<>
			<Modal
				open={dialog === "add-server"}
				onClose={onCloseDialog}
				title="Adicionar servidor"
				description="Crie sua própria comunidade ou entre usando um código de convite."
			>
				<div className="grid gap-3 sm:grid-cols-2">
					<ServerAction
						icon={<Plus className="size-6" />}
						title="Criar servidor"
						description="Comece uma comunidade nova."
						onClick={() => openDialog("create-server")}
					/>
					<ServerAction
						icon={<Users className="size-6" />}
						title="Entrar com código"
						description="Cole o código de um convite."
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
								{creating ? "Salvando..." : textDialog.submitLabel}
							</button>
						</div>
					</form>
				)}
			</Modal>

			<Modal
				open={inviteCode !== null}
				onClose={() => setInviteCode(null)}
				title="Convite criado"
				description="O código já foi copiado para a área de transferência."
			>
				<div className="rounded-2xl bg-(--surface) p-4 text-center font-mono text-lg font-black tracking-wider">
					{inviteCode}
				</div>
				<button
					type="button"
					onClick={() => void navigator.clipboard?.writeText(inviteCode ?? "")}
					className="mt-4 w-full rounded-xl bg-(--solid) px-4 py-3 text-sm font-bold text-(--on-solid)"
				>
					Copiar código
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
			className={`relative cursor-pointer rounded-2xl border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--brand) ${
				selected
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
				className={`mb-3 grid size-9 place-items-center rounded-xl [&>svg]:size-4 ${
					selected
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
				className={`absolute right-3 top-3 size-2.5 rounded-full border ${
					selected
						? "border-(--brand) bg-(--brand)"
						: "border-(--muted-text)/50"
				}`}
			/>
		</label>
	);
}
