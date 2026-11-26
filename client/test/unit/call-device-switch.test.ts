import { describe, expect, test } from "bun:test";
import { createCallDeviceSwitcher } from "../../src/features/realtime/lib/call-device-switch";
import { defaultMediaDevicePreferences } from "../../src/lib/media-devices";

class Track {
	enabled = true;
	readyState: MediaStreamTrackState = "live";
	constructor(readonly kind: "audio" | "video") {}
	stop() { this.readyState = "ended"; }
	asTrack() { return this as unknown as MediaStreamTrack; }
}

class Stream {
	constructor(private tracks: MediaStreamTrack[]) {}
	getTracks() { return [...this.tracks]; }
	getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
	getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
	addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
	removeTrack(track: MediaStreamTrack) { this.tracks = this.tracks.filter((item) => item !== track); }
	asStream() { return this as unknown as MediaStream; }
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

function setup(kind: "audio" | "video" = "audio") {
	const old = new Track(kind);
	const replacement = new Track(kind);
	const stream = new Stream([old.asTrack()]);
	let current: MediaStream | null = stream.asStream();
	let preferences = { ...defaultMediaDevicePreferences };
	let published: MediaStream | null = null;
	let acquire = async (_constraints: MediaStreamConstraints) => new Stream([replacement.asTrack()]).asStream();
	let validateOutput = async (_deviceId: string | null) => {};
	const peers: RTCPeerConnection[] = [];
	const change = createCallDeviceSwitcher({
		getStream: () => current,
		getConnections: () => peers,
		acquire: (constraints) => acquire(constraints),
		validateOutput: (id) => validateOutput(id),
		commitPreference: (key, id) => { preferences = { ...preferences, [key]: id }; },
		publish: (value) => { published = value; },
	});
	function addPeer(replace = async (_track: MediaStreamTrack | null) => {}) {
		const sender = {
			track: old.asTrack() as MediaStreamTrack | null,
			async replaceTrack(track: MediaStreamTrack | null) {
				await replace(track);
				this.track = track;
			},
		};
		peers.push({ getSenders: () => [sender] } as unknown as RTCPeerConnection);
		return sender;
	}
	return {
		old, replacement, stream, change, addPeer,
		get preferences() { return preferences; },
		get published() { return published; },
		setAcquire(value: typeof acquire) { acquire = value; },
		setValidateOutput(value: typeof validateOutput) { validateOutput = value; },
		endCall() { current = null; stream.getTracks().forEach((track) => track.stop()); },
	};
}

describe("transactional call device switching", () => {
	test("retains the microphone and preference when capture is denied", async () => {
		const call = setup();
		const sender = call.addPeer();
		call.setAcquire(async () => { throw new DOMException("Denied", "NotAllowedError"); });
		await expect(call.change("audioInputDeviceId", "missing")).rejects.toMatchObject({ name: "NotAllowedError" });
		expect(call.stream.getAudioTracks()).toEqual([call.old.asTrack()]);
		expect(sender.track).toBe(call.old.asTrack());
		expect(call.old.readyState).toBe("live");
		expect(call.preferences.audioInputDeviceId).toBeNull();
	});

	test("commits only after every sender accepts the muted replacement", async () => {
		const call = setup();
		call.old.enabled = false;
		const waiting = deferred<void>();
		const entered = deferred<void>();
		const first = call.addPeer();
		const second = call.addPeer(async () => { entered.resolve(); await waiting.promise; });
		const operation = call.change("audioInputDeviceId", "new-mic");
		await entered.promise;
		expect(call.preferences.audioInputDeviceId).toBeNull();
		expect(call.old.readyState).toBe("live");
		expect(call.replacement.enabled).toBe(false);
		waiting.resolve();
		expect(await operation).toBe(true);
		expect(first.track).toBe(call.replacement.asTrack());
		expect(second.track).toBe(call.replacement.asTrack());
		expect(call.stream.getAudioTracks()).toEqual([call.replacement.asTrack()]);
		expect(call.old.readyState).toBe("ended");
		expect(call.preferences.audioInputDeviceId).toBe("new-mic");
		expect(call.published).toBe(call.stream.asStream());
	});

	test("rolls back senders and stops acquired tracks after replacement failure", async () => {
		const call = setup();
		const extra = new Track("video");
		call.setAcquire(async () => new Stream([call.replacement.asTrack(), extra.asTrack()]).asStream());
		const first = call.addPeer();
		call.addPeer(async () => { throw new Error("replace failed"); });
		await expect(call.change("audioInputDeviceId", "new-mic")).rejects.toThrow("replace failed");
		expect(first.track).toBe(call.old.asTrack());
		expect(call.old.readyState).toBe("live");
		expect(call.replacement.readyState).toBe("ended");
		expect(extra.readyState).toBe("ended");
		expect(call.preferences.audioInputDeviceId).toBeNull();
		expect(call.published).toBeNull();
	});

	test("rejects an ended requested track and cleans all acquired tracks", async () => {
		const call = setup();
		call.replacement.stop();
		const extra = new Track("video");
		call.setAcquire(async () => new Stream([call.replacement.asTrack(), extra.asTrack()]).asStream());
		await expect(call.change("audioInputDeviceId", "invalid")).rejects.toMatchObject({ name: "NotFoundError" });
		expect(call.old.readyState).toBe("live");
		expect(extra.readyState).toBe("ended");
		expect(call.preferences.audioInputDeviceId).toBeNull();
	});

	test("discards capture that completes after the call ends", async () => {
		const call = setup();
		const capture = deferred<MediaStream>();
		const entered = deferred<void>();
		call.setAcquire(() => { entered.resolve(); return capture.promise; });
		const operation = call.change("audioInputDeviceId", "new-mic");
		await entered.promise;
		call.endCall();
		capture.resolve(new Stream([call.replacement.asTrack()]).asStream());
		expect(await operation).toBe(false);
		expect(call.replacement.readyState).toBe("ended");
		expect(call.preferences.audioInputDeviceId).toBeNull();
		expect(call.published).toBeNull();
	});

	test("discards superseded capture before processing the latest selection", async () => {
		const call = setup();
		const firstCapture = deferred<MediaStream>();
		const entered = deferred<void>();
		call.setAcquire(() => { entered.resolve(); return firstCapture.promise; });
		const first = call.change("audioInputDeviceId", "first");
		await entered.promise;
		const finalTrack = new Track("audio");
		const latest = call.change("audioInputDeviceId", "latest");
		call.setAcquire(async () => new Stream([finalTrack.asTrack()]).asStream());
		firstCapture.resolve(new Stream([call.replacement.asTrack()]).asStream());
		expect(await first).toBe(false);
		expect(await latest).toBe(true);
		expect(call.replacement.readyState).toBe("ended");
		expect(call.stream.getAudioTracks()).toEqual([finalTrack.asTrack()]);
		expect(call.preferences.audioInputDeviceId).toBe("latest");
	});

	test("preserves mute changes made while replacing a sender", async () => {
		const call = setup();
		const waiting = deferred<void>();
		const entered = deferred<void>();
		call.addPeer(async () => { entered.resolve(); await waiting.promise; });
		const operation = call.change("audioInputDeviceId", "new-mic");
		await entered.promise;
		call.old.enabled = false;
		waiting.resolve();
		await operation;
		expect(call.replacement.enabled).toBe(false);
	});

	test("rejects a candidate that ends while a sender accepts it", async () => {
		const call = setup();
		const sender = call.addPeer(async () => { call.replacement.stop(); });
		await expect(call.change("audioInputDeviceId", "ended-mic")).rejects.toMatchObject({ name: "NotFoundError" });
		expect(sender.track).toBe(call.old.asTrack());
		expect(call.old.readyState).toBe("live");
		expect(call.preferences.audioInputDeviceId).toBeNull();
	});

	test("validates a camera selection while off without turning the camera on", async () => {
		const call = setup("video");
		call.stream.removeTrack(call.old.asTrack());
		call.old.stop();
		expect(await call.change("videoInputDeviceId", "camera")).toBe(true);
		expect(call.stream.getVideoTracks()).toHaveLength(0);
		expect(call.replacement.readyState).toBe("ended");
		expect(call.preferences.videoInputDeviceId).toBe("camera");
		expect(call.published).toBeNull();
	});

	test("retains speaker preference when output validation fails", async () => {
		const call = setup();
		call.setValidateOutput(async () => { throw new DOMException("Unavailable", "NotFoundError"); });
		await expect(call.change("audioOutputDeviceId", "missing")).rejects.toMatchObject({ name: "NotFoundError" });
		expect(call.preferences.audioOutputDeviceId).toBeNull();
	});

	test("commits a speaker preference only after output validation completes", async () => {
		const call = setup();
		const validation = deferred<void>();
		const entered = deferred<void>();
		call.setValidateOutput(() => { entered.resolve(); return validation.promise; });
		const operation = call.change("audioOutputDeviceId", "speakers");
		await entered.promise;
		expect(call.preferences.audioOutputDeviceId).toBeNull();
		validation.resolve();
		expect(await operation).toBe(true);
		expect(call.preferences.audioOutputDeviceId).toBe("speakers");
		expect(call.old.readyState).toBe("live");
	});
});
