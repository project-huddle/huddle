import type { MutableRefObject } from "react";
import {
	readMediaDevicePreferences,
	writeMediaDevicePreferences,
} from "@/lib/media-devices";
import { mediaErrorMessage } from "@/lib/realtime";

type Options = {
	cameraOff: boolean;
	localStream: MutableRefObject<MediaStream | null>;
	connections: MutableRefObject<Map<string, RTCPeerConnection>>;
	makeOffer: (userId: string, peer: RTCPeerConnection) => Promise<void>;
	setLocalMediaStream: (stream: MediaStream | null) => void;
	setCameraOff: (off: boolean) => void;
	setError: (message: string | null) => void;
};

export function useCallDevices({
	cameraOff,
	localStream,
	connections,
	makeOffer,
	setLocalMediaStream,
	setCameraOff,
	setError,
}: Options) {
	const changeDevice = async (
		kind:
			"audioInputDeviceId" | "videoInputDeviceId" | "audioOutputDeviceId",
		deviceId: string | null,
	) => {
		const preferences = {
			...readMediaDevicePreferences(),
			[kind]: deviceId,
		};
		writeMediaDevicePreferences(preferences);
		if (kind === "audioOutputDeviceId") return;
		const stream = localStream.current;
		if (!stream || (kind === "videoInputDeviceId" && cameraOff)) return;
		const next = await navigator.mediaDevices.getUserMedia(
			kind === "audioInputDeviceId"
				? {
						audio: {
							deviceId: deviceId
								? { exact: deviceId }
								: undefined,
						},
						video: false,
					}
				: {
						audio: false,
						video: {
							deviceId: deviceId
								? { exact: deviceId }
								: undefined,
						},
					},
		);
		const nextTrack =
			kind === "audioInputDeviceId"
				? next.getAudioTracks()[0]
				: next.getVideoTracks()[0];
		if (!nextTrack) return;
		const oldTracks =
			kind === "audioInputDeviceId"
				? stream.getAudioTracks()
				: stream.getVideoTracks();
		for (const pc of connections.current.values()) {
			const sender = pc
				.getSenders()
				.find((item) => item.track && oldTracks.includes(item.track));
			if (sender) await sender.replaceTrack(nextTrack);
		}
		oldTracks.forEach((track) => {
			stream.removeTrack(track);
			track.stop();
		});
		stream.addTrack(nextTrack);
		setLocalMediaStream(new MediaStream(stream.getTracks()));
	};

	const toggleCamera = async () => {
		const stream = localStream.current;
		if (!stream) return;

		if (!cameraOff) {
			const videoTracks = stream.getVideoTracks();
			for (const [userId, pc] of connections.current) {
				for (const sender of pc.getSenders()) {
					if (sender.track && videoTracks.includes(sender.track))
						pc.removeTrack(sender);
				}
				await makeOffer(userId, pc);
			}
			videoTracks.forEach((track) => {
				stream.removeTrack(track);
				track.stop();
			});
			setLocalMediaStream(new MediaStream(stream.getTracks()));
			setCameraOff(true);
			return;
		}

		setError(null);
		try {
			const videoDeviceId =
				readMediaDevicePreferences().videoInputDeviceId;
			const cameraConstraints = {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				facingMode: "user",
				...(videoDeviceId
					? { deviceId: { exact: videoDeviceId } }
					: {}),
			};
			let cameraStream: MediaStream;
			try {
				cameraStream = await navigator.mediaDevices.getUserMedia({
					video: cameraConstraints,
					audio: false,
				});
			} catch (cause) {
				if (
					videoDeviceId &&
					cause instanceof DOMException &&
					cause.name === "OverconstrainedError"
				) {
					writeMediaDevicePreferences({
						...readMediaDevicePreferences(),
						videoInputDeviceId: null,
					});
					cameraStream = await navigator.mediaDevices.getUserMedia({
						video: {
							width: { ideal: 1280 },
							height: { ideal: 720 },
							facingMode: "user",
						},
						audio: false,
					});
				} else throw cause;
			}
			const track = cameraStream.getVideoTracks()[0];
			if (!track)
				throw new DOMException("No camera track", "NotFoundError");
			stream.addTrack(track);
			for (const [userId, pc] of connections.current) {
				pc.addTrack(track, stream);
				await makeOffer(userId, pc);
			}
			setLocalMediaStream(new MediaStream(stream.getTracks()));
			setCameraOff(false);
		} catch (cause) {
			setError(mediaErrorMessage(cause, "camera"));
		}
	};

	return { changeDevice, toggleCamera };
}
