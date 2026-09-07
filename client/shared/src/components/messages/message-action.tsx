import type { ReactElement } from "react";

export function MessageAction({ children, label, onClick }: { children: ReactElement; label: string; onClick: () => void }) {
	return <button onClick={onClick} className="rounded p-1 hover:bg-[var(--surface)]/20 [&_svg]:size-3.5" title={label} aria-label={label}>{children}</button>;
}
