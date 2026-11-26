import { afterEach, expect, test } from "bun:test";
import { applyAudioOutput, validateAudioOutputDevice } from "../../src/lib/media-devices";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

afterEach(() => {
	if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
	else Reflect.deleteProperty(globalThis, "navigator");
	if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
	else Reflect.deleteProperty(globalThis, "document");
});

function browserOutput({ available = true, supported = true, denied = false } = {}) {
	let sink = "previous";
	const element = supported ? {
		async setSinkId(id: string) {
			if (denied) throw new DOMException("Denied", "NotAllowedError");
			sink = id;
		},
	} : {};
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: { mediaDevices: { enumerateDevices: async () => available ? [{ kind: "audiooutput", deviceId: "speakers" }] : [] } },
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { createElement: () => element },
	});
	return { element: element as HTMLMediaElement, get sink() { return sink; } };
}

test("rejects unavailable speakers before accepting the output selection", async () => {
	const output = browserOutput({ available: false });
	await expect(validateAudioOutputDevice("speakers")).rejects.toMatchObject({ name: "NotFoundError" });
	expect(output.sink).toBe("previous");
});

test("rejects speaker selection when sink routing is unsupported", async () => {
	browserOutput({ supported: false });
	await expect(validateAudioOutputDevice("speakers")).rejects.toMatchObject({ name: "NotSupportedError" });
});

test("propagates a denied speaker route for the caller to retain its preference", async () => {
	browserOutput({ denied: true });
	await expect(validateAudioOutputDevice("speakers")).rejects.toMatchObject({ name: "NotAllowedError" });
});

test("validates speakers with the requested sink", async () => {
	const output = browserOutput();
	await validateAudioOutputDevice("speakers");
	expect(output.sink).toBe("speakers");
});

test("returning to system output resets the existing media element sink", async () => {
	const output = browserOutput();
	expect(await applyAudioOutput(output.element, null)).toBe(true);
	expect(output.sink).toBe("");
});
