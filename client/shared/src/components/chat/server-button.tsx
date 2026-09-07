import { cn, getInitials } from "@/lib/utils";

type ServerButtonProps = {
	id: string;
	name: string;
	active: boolean;
	onSelect: (id: string) => void;
	size?: "default" | "small";
};


export default function ServerButton({
	id,
	name,
	active,
	onSelect,
	size = "default",
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
				"grid place-items-center font-black transition",
				size === "default"
					? "size-11 rounded-[15px] text-sm"
					: "size-10 rounded-[13px] text-xs",
				active
					? "bg-(--brand) text-(--ink)"
					: "bg-(--surface)/10 text-(--on-solid) hover:bg-(--surface)/20",
			)}
		>
			{getInitials(name)}
		</button>
	);
}
