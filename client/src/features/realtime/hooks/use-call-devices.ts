import { useRef, type MutableRefObject } from "react";
import { createCallDeviceSwitcher } from "@/features/realtime/lib/call-device-switch";
import {
	readMediaDevicePreferences,
	validateAudioOutputDevice,
	writeMediaDevicePreferences,
	type MediaDevicePreferences,
} from "@/shared/lib/media-devices";
import { mediaErrorMessage } from "@/features/realtime/lib/realtime";

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
	const latest = useRef({ localStream, connections, setLocalMediaStream });
	latest.current = { localStream, connections, setLocalMediaStream };
	const switchDevice = useRef<ReturnType<typeof createCallDeviceSwitcher> | null>(null);
	if (!switchDevice.current) {
		switchDevice.current = createCallDeviceSwitcher({
			getStream: () => latest.current.localStream.current,
			getConnections: () => latest.current.connections.current.values(),
			acquire: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
			validateOutput: validateAudioOutputDevice,
			commitPreference: (kind, deviceId) => {
				writeMediaDevicePreferences({ ...readMediaDevicePreferences(), [kind]: deviceId });
			},
			publish: (stream) => latest.current.setLocalMediaStream(new MediaStream(stream.getTracks())),
		});
	}
	const changeDevice = async (
		kind: keyof MediaDevicePreferences,
		deviceId: string | null,
	) => {
		const stream = localStream.current;
		if (!stream) return;
		setError(null);
		try {
			await switchDevice.current?.(kind, deviceId);
		} catch (cause) {
			if (localStream.current !== stream) return;
			if (kind === "audioOutputDeviceId") {
				setError("Não foi possível alterar a saída de áudio. Verifique se o dispositivo está disponível e se o navegador permite selecionar a saída.");
				return;
			}
			const action = kind === "audioInputDeviceId" ? "microphone" : "camera";
			setError(mediaErrorMessage(cause, action));
		}
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
