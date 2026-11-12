import { ShieldCheck, KeyRound } from "lucide-react";
import { SettingsSection } from "./profile-settings-fields";
import type { useProfileSettings } from "@/hooks/use-profile-settings";

export function ProfileSecuritySettings({
	settings,
}: {
	settings: ReturnType<typeof useProfileSettings>;
}) {
	const {
		profile,
		code,
		setCode,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		sendCode,
		verifyEmail,
		toggle2fa,
		changePassword,
	} = settings;
	if (!profile) return null;
	return (
		<div className="space-y-5">
			<SettingsSection
				icon={<ShieldCheck />}
				title="E-mail e autenticação"
				description="Proteja o acesso à sua conta."
			>
				<p className="text-sm text-(--muted-text)">
					{profile.emailVerifiedAt
						? "Seu e-mail está confirmado."
						: "Confirme seu e-mail para habilitar mais proteção."}
				</p>
				{!profile.emailVerifiedAt && (
					<div className="mt-3 space-y-2">
						<button
							type="button"
							onClick={() => void sendCode()}
							className="rounded-xl border border-(--line) px-3 py-2 text-sm font-bold"
						>
							Enviar código
						</button>
						<div className="flex gap-2">
							<input
								value={code}
								onChange={(event) =>
									setCode(
										event.target.value
											.replace(/\D/g, "")
											.slice(0, 6),
									)
								}
								placeholder="Código de 6 dígitos"
								className="h-10 min-w-0 flex-1 rounded-xl border border-(--line) bg-(--canvas) px-3"
							/>
							<button
								type="button"
								onClick={() => void verifyEmail()}
								className="rounded-xl bg-(--brand) px-3 text-sm font-bold"
							>
								Confirmar
							</button>
						</div>
					</div>
				)}
				<div className="mt-4 flex items-center justify-between border-t border-(--line) pt-4">
					<div>
						<p className="text-sm font-bold">
							Verificação em duas etapas
						</p>
						<p className="text-xs text-(--muted-text)">
							Código por e-mail em novos acessos.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void toggle2fa()}
						className="rounded-xl border border-(--line) px-3 py-2 text-sm font-bold"
					>
						{profile.twoFactorEnabled ? "Desativar" : "Ativar"}
					</button>
				</div>
			</SettingsSection>
			<SettingsSection
				icon={<KeyRound />}
				title="Senha e sessão"
				description="Atualize sua senha ou encerre esta sessão."
			>
				<div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
					<form
						onSubmit={changePassword}
						className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
					>
						<input
							type="password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={(event) =>
								setCurrentPassword(event.target.value)
							}
							placeholder="Senha atual"
							className="h-11 min-w-0 rounded-xl border border-(--line) bg-(--canvas) px-3"
						/>
						<input
							type="password"
							autoComplete="new-password"
							value={newPassword}
							onChange={(event) =>
								setNewPassword(event.target.value)
							}
							placeholder="Nova senha"
							minLength={8}
							className="h-11 min-w-0 rounded-xl border border-(--line) bg-(--canvas) px-3"
						/>
						<button className="rounded-xl border border-(--line) px-4 text-sm font-bold">
							Atualizar senha
						</button>
					</form>
				</div>
			</SettingsSection>
		</div>
	);
}
