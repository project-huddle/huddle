import { ChannelActions } from "./channel-actions";
import { cn } from "@/lib/utils";
import type { HuddleChannel } from "@/lib/api";
import { Hash, Volume2 } from "lucide-react";
import type { User } from "@/lib/api";
import { UserAvatar } from "@/components/user-avatar";

type ChannelButtonProps = {
	id: string;
	name: string;
	active: boolean;
	type: HuddleChannel["type"];
	onSelect: (id: string) => void;
	variant?: "desktop" | "mobile";
	voiceUsers?: User[];
};

export default function ChannelButton({
	id,
	name,
	active,
	type,
	onSelect,
	variant = "desktop",
	voiceUsers = [],
}: ChannelButtonProps) {
	const handleClick = () => {
		onSelect(id);
	};

	return (
		<div
			className={cn(
				"group/channel flex min-w-0 flex-wrap items-center rounded-xl transition-colors hover:bg-(--surface)/70 focus-within:bg-(--surface)/70 focus-within:ring-2 focus-within:ring-(--brand)/35",
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
			{type === "voice" && voiceUsers.length > 0 && <div className="basis-full mb-1 ml-9 grid gap-1 pb-1">{voiceUsers.map((user) => <div key={user.id} className="flex min-w-0 items-center gap-2 text-xs text-(--muted-text)"><UserAvatar user={user} className="size-5 rounded-md" /><span className="truncate">{user.displayName}</span></div>)}</div>}
		</div>
	);
}
