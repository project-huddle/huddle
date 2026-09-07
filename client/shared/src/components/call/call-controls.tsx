import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CallControl({ active, danger, icon, label, onClick, positive }: { active?: boolean; danger?: boolean; icon: ReactNode; label: string; onClick: () => void; positive?: boolean }) {
	return <button type="button" onClick={onClick} title={label} aria-label={label} className={cn(
		"grid size-11 place-items-center rounded-2xl transition hover:-translate-y-0.5",
		danger ? "bg-[#d75a4a] text-white" : positive ? "bg-[#74a67d] text-white" : active ? "bg-[#d75a4a] text-white" : "bg-(--surface)",
	)}>{icon}</button>;
}
