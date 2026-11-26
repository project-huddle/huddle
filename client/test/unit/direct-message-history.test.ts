import { expect, test } from "bun:test";
import { mergeDirectMessages } from "../../src/lib/direct-message-history";
import type { DirectMessage } from "../../src/types/social";

function message(
	id: string,
	createdAt = "2026-11-12T00:00:00.000Z",
): DirectMessage {
	return {
		id,
		createdAt,
		senderId: "alice",
		recipientId: "bob",
		content: id,
		media: null,
	};
}

test("merges earlier pages with realtime messages once and orders timestamp ties by id", () => {
	const current = [message("c"), message("d", "2026-11-12T01:00:00.000Z")];
	const earlier = [message("a"), message("b"), message("c")];
	expect(mergeDirectMessages(earlier, current).map(({ id }) => id)).toEqual([
		"a",
		"b",
		"c",
		"d",
	]);
});

test("keeps the existing realtime version when a fetched page overlaps", () => {
	const current = {
		...message("a"),
		media: { type: "image" as const, url: "/media/realtime", alt: "image" },
	};
	expect(mergeDirectMessages([message("a")], [current])).toEqual([current]);
});
