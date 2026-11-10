import { UserRound } from "lucide-react";
import { SettingsSection, DeviceSelect } from "./profile-settings-fields";
import { UserAvatar } from "./user-avatar";
import type { useProfileSettings } from "@/hooks/use-profile-settings";

export function ProfileDetailsSettings({
	settings,
}: {
	settings: ReturnType<typeof useProfileSettings>;
}) {
	const {
		profile,
		setProfile,
		avatarRef,
		save,
		uploadAvatar,
		devices,
		devicePreferences,
		setDevicePreferences,
		saving,
	} = settings;
	if (!profile) return null;
	return (
		<div className="space-y-5">
			<section className="flex flex-col gap-4 rounded-3xl bg-(--solid) p-5 text-(--on-solid) sm:flex-row sm:items-center">
				<UserAvatar user={profile} className="size-16 rounded-2xl" />
				<div className="min-w-0 flex-1">
					<p className="truncate text-xl font-black">
						{profile.displayName}
					</p>
					<p className="truncate text-sm text-(--on-solid)/60">
						{profile.email}
					</p>
				</div>
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
					className="rounded-xl bg-(--surface)/10 px-4 py-2.5 text-sm font-bold hover:bg-(--surface)/20"
				>
					Alterar foto
				</button>
			</section>
			<SettingsSection
				icon={<UserRound />}
				title="Perfil"
				description="Informações visíveis para outras pessoas."
			>
				<form onSubmit={save} className="space-y-4">
					<label className="block text-sm font-bold">
						Nome de usuário
						<input
							required
							minLength={2}
							maxLength={32}
							value={profile.displayName}
							onChange={(event) =>
								setProfile({
									...profile,
									displayName: event.target.value,
								})
							}
							className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3 outline-none focus:ring-2 focus:ring-(--brand)"
						/>
					</label>
					<DeviceSelect
						label="Microfone"
						kind="audioinput"
						devices={devices}
						value={devicePreferences.audioInputDeviceId}
						onChange={(value) =>
							setDevicePreferences({
								...devicePreferences,
								audioInputDeviceId: value,
							})
						}
					/>
					<DeviceSelect
						label="Saída de áudio"
						kind="audiooutput"
						devices={devices}
						value={devicePreferences.audioOutputDeviceId}
						onChange={(value) =>
							setDevicePreferences({
								...devicePreferences,
								audioOutputDeviceId: value,
							})
						}
					/>
					<DeviceSelect
						label="Câmera"
						kind="videoinput"
						devices={devices}
						value={devicePreferences.videoInputDeviceId}
						onChange={(value) =>
							setDevicePreferences({
								...devicePreferences,
								videoInputDeviceId: value,
							})
						}
					/>
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
							className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3"
						>
							<option value="">Não informado</option>
							<option value="BR">Brasil</option>
							<option value="PT">Portugal</option>
							<option value="US">Estados Unidos</option>
							<option value="ZZ">Outro</option>
						</select>
					</label>
					<button
						disabled={saving}
						className="rounded-xl bg-(--solid) px-4 py-2.5 text-sm font-bold text-(--on-solid) disabled:opacity-50"
					>
						{saving ? "Salvando..." : "Salvar perfil"}
					</button>
				</form>
			</SettingsSection>
		</div>
	);
}
