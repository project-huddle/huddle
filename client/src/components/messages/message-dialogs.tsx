import type { FormEvent } from "react";
import { Modal } from "@/components/ui/modal";

type Props = {
	editing: boolean;
	editValue: string;
	reporting: boolean;
	reportReason: string;
	onEditValue: (value: string) => void;
	onReportReason: (value: string) => void;
	onCloseEdit: () => void;
	onCloseReport: () => void;
	onSubmitEdit: (event: FormEvent) => void;
	onSubmitReport: (event: FormEvent) => void;
};

export function MessageDialogs(props: Props) {
	return <>
		<Modal open={props.editing} onClose={props.onCloseEdit} title="Editar mensagem" description="Revise o texto antes de salvar.">
			<form onSubmit={props.onSubmitEdit}>
				<textarea autoFocus value={props.editValue} onChange={(event) => props.onEditValue(event.target.value.slice(0, 2000))} rows={5} className="w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 outline-none focus:ring-2 focus:ring-[var(--brand)]" />
				<div className="mt-4 flex justify-end gap-2">
					<button type="button" onClick={props.onCloseEdit} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--surface)]">Cancelar</button>
					<button disabled={!props.editValue.trim()} className="rounded-xl bg-[var(--solid)] px-4 py-2.5 text-sm font-bold text-[var(--on-solid)] disabled:opacity-40">Salvar</button>
				</div>
			</form>
		</Modal>
		<Modal open={props.reporting} onClose={props.onCloseReport} title="Denunciar mensagem" description="A equipe de moderação receberá o contexto e sua explicação.">
			<form onSubmit={props.onSubmitReport}>
				<textarea autoFocus value={props.reportReason} onChange={(event) => props.onReportReason(event.target.value.slice(0, 1000))} rows={5} placeholder="Explique o que aconteceu (mínimo de 10 caracteres)" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" />
				<button disabled={props.reportReason.trim().length < 10} className="mt-3 w-full rounded-xl bg-[var(--solid)] px-4 py-3 font-bold text-[var(--on-solid)] disabled:opacity-40">Enviar denúncia</button>
			</form>
		</Modal>
	</>;
}
