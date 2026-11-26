import { afterEach, expect, test } from "bun:test";
import { fetchRTCConfiguration } from "../../src/features/realtime/lib/realtime";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("acquires authenticated ICE configuration without reusing expiring credentials", async () => {
	let acquisitions = 0;
	globalThis.fetch = (async (input, options) => {
		expect(String(input)).toEndWith("/calls/ice-config");
		expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer session-token");
		expect(options?.cache).toBe("no-store");
		acquisitions += 1;
		return Response.json({
			iceServers: [{ urls: "turn:relay.example.test", username: `expiry-${acquisitions}`, credential: `credential-${acquisitions}` }],
			expiresAt: "2026-11-12T12:00:00.000Z",
		});
	}) as typeof fetch;

	const first = await fetchRTCConfiguration("session-token");
	const refreshed = await fetchRTCConfiguration("session-token");
	expect(first.iceServers?.[0]?.credential).toBe("credential-1");
	expect(refreshed.iceServers?.[0]?.credential).toBe("credential-2");
});

test("rejects ICE acquisition when the session has expired", async () => {
	globalThis.fetch = (async () => Response.json({
		error: { message: "Sessão expirada." },
	}, { status: 401 })) as typeof fetch;
	await expect(fetchRTCConfiguration("expired-token")).rejects.toThrow("Sessão expirada.");
});
