import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useProfileSettings } from "@/hooks/use-profile-settings";
import type { UserProfile } from "@/lib/api";
import { ProfileDetailsSettings } from "./profile-details-settings";
import { ProfileAppearanceSettings } from "./profile-appearance-settings";
import { ProfileSecuritySettings } from "./profile-security-settings";

type ProfileSettingsProps = {
	token: string;
	open: boolean;
	onClose: () => void;
	onLogout: () => void;
	onUpdated: (user: UserProfile) => void;
};

const tabs = [
	{ id: "profile", label: "Perfil e dispositivos" },
	{ id: "appearance", label: "Aparência" },
	{ id: "security", label: "Segurança e sessão" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export function ProfileSettings({
	token,
	open,
	onClose,
	onLogout,
	onUpdated,
}: ProfileSettingsProps) {
	const settings = useProfileSettings({ token, open, onUpdated });
	const [tab, setTab] = useState<Tab>("profile");
	const handleLogout = () => {
		onClose();
		onLogout();
	};
	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Configurações"
			description="Gerencie seu perfil, aparência e segurança."
			wide
		>
			{settings.message && (
				<p
					role="status"
					className="mb-5 rounded-xl border border-(--line) bg-(--surface) p-3 text-sm"
				>
					{settings.message}
				</p>
			)}
			{!settings.profile && !settings.message && (
				<p role="status">Carregando perfil...</p>
			)}
			{settings.profile && (
				<div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
					<nav
						aria-label="Seções das configurações de perfil"
						className="flex gap-2 overflow-x-auto border-b border-(--line) pb-3 md:flex-col md:border-b-0 md:border-r md:pr-4"
					>
						{tabs.map((item) => (
							<button
								key={item.id}
								type="button"
								aria-current={
									tab === item.id ? "page" : undefined
								}
								onClick={() => setTab(item.id)}
								className={`shrink-0 rounded-xl px-3 py-3 text-left text-sm font-bold ${tab === item.id ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}
							>
								{item.label}
							</button>
						))}
					</nav>
					<div className="min-w-0">
						{tab === "profile" && (
							<ProfileDetailsSettings settings={settings} />
						)}
						{tab === "appearance" && (
							<ProfileAppearanceSettings />
						)}
						{tab === "security" && (
							<ProfileSecuritySettings
								settings={settings}
								handleLogout={handleLogout}
							/>
						)}
					</div>
				</div>
			)}
		</Modal>
	);
}
