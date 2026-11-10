import { useCallback, useRef, type MutableRefObject } from "react";
import { mediaErrorMessage } from "@/lib/realtime";
import type { CallLifecycle } from "@/types/realtime";

type Options = {
	sharing: boolean;
	displayStream: MutableRefObject<MediaStream | null>;
	connections: MutableRefObject<Map<string, RTCPeerConnection>>;
	callLifecycle: MutableRefObject<CallLifecycle>;
	callAttempt: MutableRefObject<number>;
	send: (event: object) => boolean;
	makeOffer: (userId: string, peer: RTCPeerConnection) => Promise<void>;
	setSharing: (sharing: boolean) => void;
	setLocalDisplayStream: (stream: MediaStream | null) => void;
	setError: (message: string | null) => void;
};

export function useScreenSharing(options: Options) {
	const selecting = useRef(false);
	const {
		sharing,
		displayStream,
		connections,
		callLifecycle,
		callAttempt,
		send,
		makeOffer,
		setSharing,
		setLocalDisplayStream,
		setError,
	} = options;
	const stopSharing = useCallback(async () => {
		const stream = displayStream.current;
		displayStream.current = null;
		setSharing(false);
		setLocalDisplayStream(null);
		if (!stream) return;
		const tracks = stream.getTracks();
		for (const track of tracks) {
			track.onended = null;
			track.stop();
		}
		for (const [userId, peer] of connections.current) {
			for (const sender of peer.getSenders()) {
				if (sender.track && tracks.includes(sender.track))
					peer.removeTrack(sender);
			}
			send({ type: "screen_share", targetUserId: userId, active: false });
			try {
				await makeOffer(userId, peer);
			} catch {
				setError(
					"Não foi possível atualizar o compartilhamento de tela.",
				);
			}
		}
	}, [
		connections,
		displayStream,
		makeOffer,
		send,
		setError,
		setLocalDisplayStream,
		setSharing,
	]);

	const toggleShare = async () => {
		if (sharing) return stopSharing();
		if (callLifecycle.current !== "active" || selecting.current) return;
		selecting.current = true;
		const attempt = callAttempt.current;
		setError(null);
		try {
			if (!navigator.mediaDevices?.getDisplayMedia)
				throw new DOMException(
					"Display media unavailable",
					"NotSupportedError",
				);
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				},
			});
			if (
				callAttempt.current !== attempt ||
				callLifecycle.current !== "active"
			) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			displayStream.current = stream;
			const video = stream.getVideoTracks()[0];
			if (!video)
				throw new DOMException("No display track", "NotFoundError");
			video.onended = () => void stopSharing();
			for (const [userId, peer] of connections.current) {
				for (const track of stream.getTracks())
					peer.addTrack(track, stream);
				send({
					type: "screen_share",
					targetUserId: userId,
					active: true,
					streamId: stream.id,
				});
				await makeOffer(userId, peer);
			}
			setLocalDisplayStream(stream);
			setSharing(true);
		} catch (cause) {
			await stopSharing();
			setError(mediaErrorMessage(cause, "screen"));
		} finally {
			selecting.current = false;
		}
	};

	return { toggleShare };
}
