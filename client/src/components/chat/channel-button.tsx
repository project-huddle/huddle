import { ChannelActions } from "./channel-actions";
import { cn } from "@/lib/utils";
import type { HuddleChannel } from "@/lib/api";
import { Hash, Volume2 } from "lucide-react";

type ChannelButtonProps = {
	id: string;
	name: string;
	active: boolean;
	type: HuddleChannel["type"];
	onSelect: (id: string) => void;
	variant?: "desktop" | "mobile";
};

export default function ChannelButton({
	id,
	name,
	active,
	type,
	onSelect,
	variant = "desktop",
}: ChannelButtonProps) {
	const handleClick = () => {
		onSelect(id);
	};

	return (
		<div
			className={cn(
				"group/channel flex min-w-0 items-center rounded-xl transition-colors hover:bg-(--surface)/70 focus-within:bg-(--surface)/70 focus-within:ring-2 focus-within:ring-(--brand)/35",
				variant === "mobile" && "mb-1",
				active && "bg-(--surface) font-bold shadow-sm",
			)}
		>
			<button
				type="button"
				onClick={handleClick}
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-left text-sm outline-none",
					variant === "desktop" ? "py-2" : "py-3",
					!active && "text-(--muted-text)",
				)}
			>
				{type === "voice" ? (
					<Volume2 className="size-4 shrink-0" />
				) : (
					<Hash className="size-4 shrink-0" />
				)}

				<span className="truncate">{name}</span>
			</button>
			<ChannelActions channelId={id} />
		</div>
	);
}
