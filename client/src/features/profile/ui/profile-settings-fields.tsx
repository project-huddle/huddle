import type { ReactNode } from "react";

export type SettingsSectionProps = {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
};

export function SettingsSection({
	icon,
	title,
	description,
	children,
}: SettingsSectionProps) {
	return (
		<section className="rounded-3xl border border-(--line) bg-(--surface) p-5">
			<header className="mb-4 flex gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--brand) text-(--ink) [&>svg]:size-4">
					{icon}
				</span>
				<div>
					<h3 className="font-black">{title}</h3>
					<p className="text-xs text-(--muted-text)">{description}</p>
				</div>
			</header>
			{children}
		</section>
	);
}

export function DeviceSelect({
	label,
	kind,
	devices,
	value,
	onChange,
}: {
	label: string;
	kind: MediaDeviceKind;
	devices: MediaDeviceInfo[];
	value: string | null;
	onChange: (value: string | null) => void;
}) {
	return (
		<label className="block text-sm font-bold">
			{label}
			<select
				value={value ?? ""}
				onChange={(event) => onChange(event.target.value || null)}
				className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3"
			>
				<option value="">Padrão do sistema</option>
				{devices
					.filter((device) => device.kind === kind)
					.map((device) => (
						<option key={device.deviceId} value={device.deviceId}>
							{device.label || "Dispositivo sem nome"}
						</option>
					))}
			</select>
		</label>
	);
}
