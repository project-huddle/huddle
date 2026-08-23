import { Modal } from "@/components/ui/modal";
import type { UserProfile } from "@/lib/api";
import { useProfileSettings } from "@/hooks/use-profile-settings";

export function ProfileSettings({
	token,
	open,
	onClose,
	onUpdated,
}: {
	token: string;
	open: boolean;
	onClose: () => void;
	onUpdated: (user: UserProfile) => void;
}) {
	const {
		profile,
		setProfile,
		code,
		setCode,
		message,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		avatarRef,
		save,
		uploadAvatar,
		sendCode,
		verifyEmail,
		toggle2fa,
		changePassword,
	} = useProfileSettings({ token, open, onUpdated });
	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Configurações do perfil"
			description="Gerencie sua identidade, privacidade e segurança."
			wide
		>
			{profile && (
				<div className="grid gap-6 md:grid-cols-2">
					<form onSubmit={save} className="space-y-4">
						<h3 className="font-black">Perfil</h3>
						<label className="block text-sm font-bold">
							Nome
							<input
								value={profile.displayName}
								onChange={(event) =>
									setProfile({
										...profile,
										displayName: event.target.value,
									})
								}
								className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
							/>
						</label>
						<input
							ref={avatarRef}
							type="file"
							accept="image/*"
							hidden
							onChange={(event) =>
								void uploadAvatar(event.target.files?.[0])
							}
						/>
						<button
							type="button"
							onClick={() => avatarRef.current?.click()}
							className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold"
						>
							Escolher foto
						</button>
						<label className="block text-sm font-bold">
							País
							<select
								value={profile.countryCode ?? ""}
								onChange={(event) =>
									setProfile({
										...profile,
										countryCode: event.target.value || null,
									})
								}
								className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
							>
								<option value="">Não informado</option>
								<option value="BR">Brasil</option>
								<option value="PT">Portugal</option>
								<option value="US">Estados Unidos</option>
								<option value="ZZ">Outro</option>
							</select>
						</label>
						<button className="rounded-xl bg-[var(--solid)] px-5 py-3 font-bold text-[var(--on-solid)]">
							Salvar perfil
						</button>
					</form>
					<section className="space-y-4">
						<h3 className="font-black">Segurança</h3>
						<div className="rounded-2xl bg-[var(--surface)] p-4">
							<p className="font-bold">Confirmação de e-mail</p>
							<p className="mt-1 text-sm text-[var(--muted-text)]">
								{profile.emailVerifiedAt
									? "E-mail confirmado."
									: "Confirme seu endereço antes de ativar o segundo fator."}
							</p>
							{!profile.emailVerifiedAt && (
								<>
									<button
										onClick={() => void sendCode()}
										className="mt-3 rounded-xl border px-3 py-2 text-sm font-bold"
									>
										Enviar código
									</button>
									<div className="mt-2 flex gap-2">
										<input
											value={code}
											onChange={(event) =>
												setCode(
													event.target.value
														.replace(/\D/g, "")
														.slice(0, 6),
												)
											}
											className="h-10 min-w-0 flex-1 rounded-xl border bg-[var(--canvas)] px-3"
										/>
										<button
											onClick={() => void verifyEmail()}
											className="rounded-xl bg-[var(--brand)] px-3 font-bold"
										>
											Confirmar
										</button>
									</div>
								</>
							)}
						</div>
						<div className="rounded-2xl bg-[var(--surface)] p-4">
							<p className="font-bold">
								Verificação em duas etapas
							</p>
							<p className="mt-1 text-sm text-[var(--muted-text)]">
								Receba um código por e-mail em cada novo login.
							</p>
							<button
								onClick={() => void toggle2fa()}
								className="mt-3 rounded-xl bg-[var(--solid)] px-4 py-2 text-sm font-bold text-[var(--on-solid)]"
							>
								{profile.twoFactorEnabled
									? "Desativar"
									: "Ativar"}
							</button>
						</div>
						<form
							onSubmit={changePassword}
							className="rounded-2xl bg-[var(--surface)] p-4"
						>
							<p className="font-bold">Alterar senha</p>
							<input
								type="password"
								autoComplete="current-password"
								value={currentPassword}
								onChange={(event) =>
									setCurrentPassword(event.target.value)
								}
								placeholder="Senha atual"
								className="mt-3 h-10 w-full rounded-xl border bg-[var(--canvas)] px-3"
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
								className="mt-2 h-10 w-full rounded-xl border bg-[var(--canvas)] px-3"
							/>
							<button className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">
								Atualizar senha
							</button>
						</form>
						{message && (
							<p
								role="status"
								className="text-sm text-[var(--muted-text)]"
							>
								{message}
							</p>
						)}
					</section>
				</div>
			)}
		</Modal>
	);
}
