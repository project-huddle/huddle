import { Palette } from "lucide-react";
import { SettingsSection } from "./profile-settings-fields";
import { ThemeToggle } from "./theme";

export function ProfileAppearanceSettings() {
	return (
		<div className="space-y-5">
			<SettingsSection
				icon={<Palette />}
				title="Aparência"
				description="Escolha como o Huddle aparece para você."
			>
				<div className="flex items-center justify-between rounded-xl border border-(--line) bg-(--canvas) p-3">
					<span className="text-sm font-semibold">Alternar tema</span>
					<ThemeToggle />
				</div>
			</SettingsSection>
		</div>
	);
}
