import type { MediaDevicePreferences } from "@/lib/media-devices";

type Options = {
	getStream: () => MediaStream | null;
	getConnections: () => Iterable<RTCPeerConnection>;
	acquire: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
	validateOutput: (deviceId: string | null) => Promise<void>;
	commitPreference: (kind: keyof MediaDevicePreferences, deviceId: string | null) => void;
	publish: (stream: MediaStream) => void;
};

type ReplacedSender = { sender: RTCRtpSender; previous: MediaStreamTrack };

class CancelledDeviceSwitch extends Error {}

function inputTracks(stream: MediaStream, kind: "audio" | "video") {
	if (kind === "audio") return stream.getAudioTracks();
	return stream.getVideoTracks();
}

async function rollbackSenders(replaced: ReplacedSender[], cause: unknown) {
	const failures: unknown[] = [];
	for (const { sender, previous } of replaced.reverse()) {
		try {
			await sender.replaceTrack(previous);
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length > 0) {
		throw new AggregateError([cause, ...failures], "Could not restore call device senders");
	}
}

export function createCallDeviceSwitcher(options: Options) {
	const requests = new Map<keyof MediaDevicePreferences, number>();
	let pending = Promise.resolve();

	return (kind: keyof MediaDevicePreferences, deviceId: string | null): Promise<boolean> => {
		const stream = options.getStream();
		const request = (requests.get(kind) ?? 0) + 1;
		requests.set(kind, request);
		const isCurrent = () => stream !== null && options.getStream() === stream && requests.get(kind) === request;
		const operation = pending.then(async () => {
			if (!isCurrent() || !stream) return false;
			if (kind === "audioOutputDeviceId") {
				try {
					await options.validateOutput(deviceId);
					if (!isCurrent()) return false;
					options.commitPreference(kind, deviceId);
					return true;
				} catch (cause) {
					if (!isCurrent()) return false;
					throw cause;
				}
			}

			const trackKind = kind === "audioInputDeviceId" ? "audio" : "video";
			const oldTracks = inputTracks(stream, trackKind);
			const tracksUnchanged = () => {
				const current = inputTracks(stream, trackKind);
				return current.length === oldTracks.length && oldTracks.every((track) => current.includes(track) && track.readyState === "live");
			};
			const ensureCurrent = () => {
				if (!isCurrent() || !tracksUnchanged()) throw new CancelledDeviceSwitch();
			};
			let captured: MediaStream | null = null;
			let retained: MediaStreamTrack | null = null;
			const replaced: ReplacedSender[] = [];
			try {
				const constraints = { deviceId: deviceId ? { exact: deviceId } : undefined };
				captured = await options.acquire({
					audio: trackKind === "audio" ? constraints : false,
					video: trackKind === "video" ? constraints : false,
				});
				ensureCurrent();
				const nextTrack = inputTracks(captured, trackKind).find((track) => track.readyState === "live");
				if (!nextTrack) throw new DOMException("No live input track", "NotFoundError");

				// A disabled camera can be selected without publishing captured video.
				if (oldTracks.length === 0) {
					options.commitPreference(kind, deviceId);
					return true;
				}
				// Keep the candidate silent until all senders have accepted the switch.
				nextTrack.enabled = false;
				for (const peer of options.getConnections()) {
					for (const sender of peer.getSenders()) {
						const previous = sender.track;
						if (!previous || !oldTracks.includes(previous)) continue;
						ensureCurrent();
						await sender.replaceTrack(nextTrack);
						replaced.push({ sender, previous });
						ensureCurrent();
					}
				}
				ensureCurrent();
				if (nextTrack.readyState !== "live") {
					throw new DOMException("Input track ended during device switch", "NotFoundError");
				}
				options.commitPreference(kind, deviceId);
				nextTrack.enabled = oldTracks.every((track) => track.enabled);
				oldTracks.forEach((track) => stream.removeTrack(track));
				stream.addTrack(nextTrack);
				retained = nextTrack;
				oldTracks.forEach((track) => track.stop());
				options.publish(stream);
				return true;
			} catch (cause) {
				await rollbackSenders(replaced, cause);
				if (cause instanceof CancelledDeviceSwitch || !isCurrent()) return false;
				throw cause;
			} finally {
				captured?.getTracks().forEach((track) => {
					if (track !== retained) track.stop();
				});
			}
		});
		pending = operation.then(() => {}, () => {});
		return operation;
	};
}
