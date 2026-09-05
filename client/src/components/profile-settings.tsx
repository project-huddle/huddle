import { KeyRound, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/user-avatar";
import { useProfileSettings } from "@/hooks/use-profile-settings";
import type { UserProfile } from "@/lib/api";

type ProfileSettingsProps = {
	token: string;
	open: boolean;
	onClose: () => void;
	onLogout: () => void;
	onUpdated: (user: UserProfile) => void;
};

export function ProfileSettings({
	token,
	open,
	onClose,
	onLogout,
	onUpdated,
}: ProfileSettingsProps) {
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

	const handleLogout = () => {
		onClose();
		onLogout();
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Configurações"
			description="Gerencie seu perfil, aparência, segurança e sessão."
			wide
		>
			{profile && (
				<div className="space-y-6">
					<section className="flex flex-col gap-4 rounded-3xl bg-(--solid) p-5 text-(--on-solid) sm:flex-row sm:items-center">
						<UserAvatar user={profile} className="size-16 rounded-2xl" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-xl font-black">{profile.displayName}</p>
							<p className="truncate text-sm text-(--on-solid)/60">{profile.email}</p>
						</div>
						<input
							ref={avatarRef}
							type="file"
							accept="image/*"
							hidden
							onChange={(event) => void uploadAvatar(event.target.files?.[0])}
						/>
						<button
							type="button"
							onClick={() => avatarRef.current?.click()}
							className="rounded-xl bg-(--surface)/10 px-4 py-2.5 text-sm font-bold hover:bg-(--surface)/20"
						>
							Alterar foto
						</button>
					</section>

					<div className="grid gap-5 lg:grid-cols-2">
						<SettingsSection icon={<UserRound />} title="Perfil" description="Informações visíveis para outras pessoas.">
							<form onSubmit={save} className="space-y-4">
								<label className="block text-sm font-bold">
									Nome de usuário
									<input
										value={profile.displayName}
										onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
										className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3 outline-none focus:ring-2 focus:ring-(--brand)"
									/>
								</label>
								<label className="block text-sm font-bold">
									País
									<select
										value={profile.countryCode ?? ""}
										onChange={(event) => setProfile({ ...profile, countryCode: event.target.value || null })}
										className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3"
									>
										<option value="">Não informado</option>
										<option value="BR">Brasil</option>
										<option value="PT">Portugal</option>
										<option value="US">Estados Unidos</option>
										<option value="ZZ">Outro</option>
									</select>
								</label>
								<button className="rounded-xl bg-(--solid) px-4 py-2.5 text-sm font-bold text-(--on-solid)">
									Salvar perfil
								</button>
							</form>
						</SettingsSection>

						<div className="space-y-5">
							<SettingsSection icon={<Palette />} title="Aparência" description="Escolha como o Huddle aparece para você.">
								<div className="flex items-center justify-between rounded-xl border border-(--line) bg-(--canvas) p-3">
									<span className="text-sm font-semibold">Alternar tema</span>
									<ThemeToggle />
								</div>
							</SettingsSection>

							<SettingsSection icon={<ShieldCheck />} title="E-mail e autenticação" description="Proteja o acesso à sua conta.">
								<p className="text-sm text-(--muted-text)">
									{profile.emailVerifiedAt ? "Seu e-mail está confirmado." : "Confirme seu e-mail para habilitar mais proteção."}
								</p>
								{!profile.emailVerifiedAt && (
									<div className="mt-3 space-y-2">
										<button type="button" onClick={() => void sendCode()} className="rounded-xl border border-(--line) px-3 py-2 text-sm font-bold">
											Enviar código
										</button>
										<div className="flex gap-2">
											<input
												value={code}
												onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
												placeholder="Código de 6 dígitos"
												className="h-10 min-w-0 flex-1 rounded-xl border border-(--line) bg-(--canvas) px-3"
											/>
											<button type="button" onClick={() => void verifyEmail()} className="rounded-xl bg-(--brand) px-3 text-sm font-bold">Confirmar</button>
										</div>
									</div>
								)}
								<div className="mt-4 flex items-center justify-between border-t border-(--line) pt-4">
									<div>
										<p className="text-sm font-bold">Verificação em duas etapas</p>
										<p className="text-xs text-(--muted-text)">Código por e-mail em novos acessos.</p>
									</div>
									<button type="button" onClick={() => void toggle2fa()} className="rounded-xl border border-(--line) px-3 py-2 text-sm font-bold">
										{profile.twoFactorEnabled ? "Desativar" : "Ativar"}
									</button>
								</div>
							</SettingsSection>
						</div>
					</div>

					<SettingsSection icon={<KeyRound />} title="Senha e sessão" description="Atualize sua senha ou encerre esta sessão.">
						<div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
							<form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
								<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" className="h-11 rounded-xl border border-(--line) bg-(--canvas) px-3" />
								<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha" minLength={8} className="h-11 rounded-xl border border-(--line) bg-(--canvas) px-3" />
								<button className="rounded-xl border border-(--line) px-4 text-sm font-bold">Atualizar senha</button>
							</form>
							<button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl bg-[#d76b5b] px-4 py-3 text-sm font-bold text-white">
								<LogOut className="size-4" /> Sair da conta
							</button>
						</div>
					</SettingsSection>

					{message && <p role="status" className="text-sm text-(--muted-text)">{message}</p>}
				</div>
			)}
		</Modal>
	);
}

type SettingsSectionProps = {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
};

function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
	return (
		<section className="rounded-3xl border border-(--line) bg-(--surface) p-5">
			<header className="mb-4 flex gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--brand) text-(--ink) [&>svg]:size-4">{icon}</span>
				<div>
					<h3 className="font-black">{title}</h3>
					<p className="text-xs text-(--muted-text)">{description}</p>
				</div>
			</header>
			{children}
		</section>
	);
}
