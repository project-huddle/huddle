import { resolveMediaUrl } from "@/lib/api";
import { cn, getInitials } from "@/lib/utils";

type ServerButtonProps = {
	iconUrl?: string | null;
	id: string;
	name: string;
	active: boolean;
	onSelect: (id: string) => void;
	size?: "default" | "small";
	unread?: number;
};

export default function ServerButton({
	iconUrl,
	id,
	name,
	active,
	onSelect,
	size = "default",
	unread = 0,
}: ServerButtonProps) {
	const handleClick = () => {
		onSelect(id);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			title={name}
			className={cn(
				"relative grid place-items-center font-black transition",
				size === "default"
					? "size-11 rounded-[15px] text-sm"
					: "size-10 rounded-[13px] text-xs",
				active
					? "bg-(--brand) text-(--ink)"
					: "bg-(--surface)/10 text-(--on-solid) hover:bg-(--surface)/20",
			)}
		>
			<span className="grid size-full place-items-center rounded-[inherit]">
				{iconUrl ? (
					<img
						src={resolveMediaUrl(iconUrl)}
						alt={`Ícone de ${name}`}
						className="size-full rounded-[inherit] object-cover"
					/>
				) : (
					getInitials(name)
				)}
				{unread > 0 && (
					<span
						className="absolute -right-3 -top-3 grid min-w-4 place-items-center rounded-full bg-(--brand) px-1 text-[9px] font-black text-(--ink)"
						aria-label={`${unread} atividade${unread === 1 ? "" : "s"} não lida${unread === 1 ? "" : "s"}`}
					>
						{unread > 99 ? "99+" : unread}
					</span>
				)}
			</span>
		</button>
	);
}
