import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";
import type { HuddleChannel } from "@/lib/api";


export function ChatDialogs() {
	const { dialog, value, creating, inviteCode, onValueChange, onCloseDialog, setInviteCode, createServer, createChannel, joinServer } = useChatStore(useShallow((state) => ({
		dialog: state.dialog,
		value: state.dialogValue,
		creating: state.creating,
		inviteCode: state.inviteCode,
		onValueChange: state.setDialogValue,
		onCloseDialog: state.closeDialog,
		setInviteCode: state.setInviteCode,
		createServer: state.createServer,
		createChannel: state.createChannel,
		joinServer: state.joinServer,
	})));
	const [channelType, setChannelType] = useState<HuddleChannel["type"]>("text");
	useEffect(() => {
		if (dialog === "create-channel") setChannelType("text");
	}, [dialog]);
	const onCloseInvite = () => setInviteCode(null);
	const onSubmit = (event: FormEvent) => { event.preventDefault(); if (dialog === "create-server") void createServer(value); if (dialog === "create-channel") void createChannel(value, channelType); if (dialog === "join-server") void joinServer(value); };
	const joining = dialog === "join-server";
	const title = dialog === "create-server" ? "Criar servidor" : dialog === "create-channel" ? "Criar canal" : "Entrar em um servidor";
	const placeholder = dialog === "create-server" ? "Minha comunidade" : dialog === "create-channel" ? "geral" : "Ex.: ABC123";

	return <>
		<Modal open={dialog !== null} onClose={onCloseDialog} title={title} description={joining ? "Cole o código de convite que você recebeu." : "Escolha um nome curto e fácil de reconhecer."}>
			<form onSubmit={onSubmit}>
				<label htmlFor="dialog-value" className="text-sm font-bold">{joining ? "Código do convite" : "Nome"}</label>
				<input id="dialog-value" autoFocus value={value} onChange={(event) => onValueChange(event.target.value)} maxLength={joining ? 100 : 60} placeholder={placeholder} className="mt-2 h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 outline-none focus:ring-2 focus:ring-[var(--brand)]" />
				{dialog === "create-channel" && <label className="mt-4 block text-sm font-bold" htmlFor="channel-type">Tipo<select id="channel-type" value={channelType} onChange={(event) => setChannelType(event.target.value as HuddleChannel["type"])} className="mt-2 h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 font-normal outline-none focus:ring-2 focus:ring-[var(--brand)]"><option value="text">Texto</option><option value="voice">Voz</option></select></label>}
				<div className="mt-5 flex justify-end gap-2">
					<button type="button" onClick={onCloseDialog} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--surface)]">Cancelar</button>
					<button disabled={!value.trim() || creating} className="rounded-xl bg-[var(--solid)] px-4 py-2.5 text-sm font-bold text-[var(--on-solid)] disabled:opacity-40">{creating ? "Salvando..." : joining ? "Entrar" : "Criar"}</button>
				</div>
			</form>
		</Modal>
		<Modal open={inviteCode !== null} onClose={onCloseInvite} title="Convite criado" description="O código já foi copiado para a área de transferência.">
			<div className="rounded-2xl bg-[var(--surface)] p-4 text-center font-mono text-lg font-black tracking-wider">{inviteCode}</div>
			<button type="button" onClick={() => void navigator.clipboard?.writeText(inviteCode ?? "")} className="mt-4 w-full rounded-xl bg-[var(--solid)] px-4 py-3 text-sm font-bold text-[var(--on-solid)]">Copiar código</button>
		</Modal>
	</>;
}
