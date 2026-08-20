import { useState } from "react";

export function TwoFactorChallenge({ error, loading, onVerify }: { error: string | null; loading: boolean; onVerify: (code: string) => Promise<void> }) {
	const [code, setCode] = useState("");
	return <main className="grid min-h-svh place-items-center bg-[var(--canvas)] p-5 text-[var(--ink)]">
		<form onSubmit={(event) => { event.preventDefault(); void onVerify(code); }} className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7">
			<h1 className="text-2xl font-black">Verificação em duas etapas</h1>
			<p className="mt-2 text-sm text-[var(--muted-text)]">Enviamos um código de seis dígitos para o seu e-mail.</p>
			<label className="mt-6 block text-sm font-bold">Código
				<input autoFocus inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-center font-mono text-xl tracking-[.3em]" />
			</label>
			{error && <p role="alert" className="mt-3 text-sm text-[#b54e42]">{error}</p>}
			<button disabled={code.length !== 6 || loading} className="mt-5 h-12 w-full rounded-2xl bg-[var(--solid)] font-bold text-[var(--on-solid)] disabled:opacity-50">Verificar e entrar</button>
		</form>
	</main>;
}
