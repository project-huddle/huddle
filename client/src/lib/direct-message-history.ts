import type { DirectMessage } from "@/types/social";

export function mergeDirectMessages(
	earlier: DirectMessage[],
	current: DirectMessage[],
) {
	const combined = new Map(
		[...earlier, ...current].map((message) => [message.id, message]),
	);
	return [...combined.values()].sort((left, right) => {
		const timeOrder = left.createdAt.localeCompare(right.createdAt);
		if (timeOrder !== 0) return timeOrder;
		if (left.id === right.id) return 0;
		return left.id < right.id ? -1 : 1;
	});
}
