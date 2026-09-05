import { ArrowRight, LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { api, type InvitePreview } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import LoginPage from "@/views/login-page";

const pendingInviteKey = "pending-server-invite";

function inviteCodeFromLocation() {
	const match = window.location.pathname.match(/^\/invite\/([a-z0-9]{6,16})$/i);
	return match?.[1]?.toLowerCase() ?? null;
}

export default function InvitePage() {
	const user = useAuthStore((state) => state.user);
	const token = useAuthStore((state) => state.token);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const [preview, setPreview] = useState<InvitePreview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [joining, setJoining] = useState(false);
	const code = inviteCodeFromLocation();

	useEffect(() => {
		if (!code) {
			setError("Este link de convite não é válido.");
			return;
		}
		if (!isAuthenticated) sessionStorage.setItem(pendingInviteKey, code);
		void api<{ invite: InvitePreview }>(`/invites/${code}`)
			.then(({ invite }) => setPreview(invite))
			.catch((cause) => {
				setError(cause instanceof Error ? cause.message : "Convite inválido ou expirado.");
			});
	}, [code, isAuthenticated]);

	useEffect(() => {
		const pendingCode = sessionStorage.getItem(pendingInviteKey);
		if (!isAuthenticated || !token || !pendingCode || pendingCode !== code) return;
		setJoining(true);
		void api<{ server: { id: string } }>("/invites/join", {
			method: "POST",
			body: JSON.stringify({ code: pendingCode }),
		}, token)
			.then(({ server }) => {
				sessionStorage.removeItem(pendingInviteKey);
				useChatStore.getState().setServerId(server.id);
				window.location.assign("/");
			})
			.catch((cause) => {
				setJoining(false);
				setError(cause instanceof Error ? cause.message : "Não foi possível entrar no servidor.");
			});
	}, [code, isAuthenticated, token]);

	if (!isAuthenticated && error) {
		return (
			<main className="grid min-h-svh place-items-center bg-(--canvas) p-5 text-(--ink)">
				<section className="w-full max-w-md rounded-[32px] border border-(--line) bg-(--surface) p-7 shadow-(--shadow-lg)">
					<InviteMessage title="Convite indisponível" message={error} />
				</section>
			</main>
		);
	}

	if (!isAuthenticated || !user || !token) return <LoginPage initialRegistering />;

	const handleJoin = () => {
		if (!code || joining) return;
		sessionStorage.setItem(pendingInviteKey, code);
		window.location.reload();
	};

	return (
		<main className="grid min-h-svh place-items-center bg-(--canvas) p-5 text-(--ink)">
			<section className="w-full max-w-md rounded-[32px] border border-(--line) bg-(--surface) p-7 shadow-(--shadow-lg)">
				{error ? (
					<InviteMessage title="Convite indisponível" message={error} />
				) : joining ? (
					<InviteMessage title="Entrando no servidor" message="Só um instante..." loading />
				) : preview ? (
					<>
						<div className="mb-6 grid size-14 place-items-center rounded-2xl bg-(--brand) text-(--ink)">
							<Users className="size-7" />
						</div>
						<p className="text-xs font-bold uppercase tracking-[0.18em] text-(--muted-text)">Convite para servidor</p>
						<h1 className="mt-2 text-3xl font-black tracking-tight">{preview.serverName}</h1>
						<p className="mt-3 text-sm text-(--muted-text)">
							Você foi convidado para entrar neste servidor. O convite expira em {new Date(preview.expiresAt).toLocaleString()}.
						</p>
						<button type="button" onClick={handleJoin} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-(--solid) font-bold text-(--on-solid)">
							Entrar no servidor <ArrowRight className="size-4" />
						</button>
					</>
				) : (
					<InviteMessage title="Carregando convite" message="Verificando o link..." loading />
				)}
			</section>
		</main>
	);
}

function InviteMessage({ title, message, loading = false }: { title: string; message: string; loading?: boolean }) {
	return (
		<div className="text-center">
			{loading && <LoaderCircle className="mx-auto mb-5 size-8 animate-spin text-(--brand)" />}
			<h1 className="text-2xl font-black">{title}</h1>
			<p className="mt-2 text-sm text-(--muted-text)">{message}</p>
		</div>
	);
}
