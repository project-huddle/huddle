import { resolveMediaUrl, type User } from "@/lib/api";
import { cn, getInitials } from "@/lib/utils";

const avatarColors = [
	"bg-[#f2a65a]",
	"bg-[#8fb996]",
	"bg-[#b8a1d9]",
	"bg-[#e58f8f]",
	"bg-[#72a6b8]",
];

export function UserAvatar({
	user,
	className,
}: {
	user: User;
	className?: string;
}) {
	const colorIndex = user.id.charCodeAt(0) % avatarColors.length;

	return (
		<div
			aria-hidden="true"
			className={cn(
				"grid size-10 shrink-0 place-items-center rounded-[14px] text-xs font-bold text-[#172019] shadow-sm",
				avatarColors[colorIndex],
				className,
			)}
		>
			{user.avatarUrl ? (
				<img
					src={resolveMediaUrl(user.avatarUrl)}
					alt=""
					className="size-full rounded-[inherit] object-cover"
				/>
			) : (
				getInitials(user.displayName)
			)}
		</div>
	);
}
