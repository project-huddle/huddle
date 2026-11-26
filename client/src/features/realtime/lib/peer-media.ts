import type { RealtimePeer } from "@/types/realtime";

/** Stream IDs distinguish a shared tab's audio from the microphone during renegotiation. */
export function receivePeerTrack(
	event: RTCTrackEvent,
	sharedStreamId: string | undefined,
	update: (changes: Partial<RealtimePeer>) => void,
) {
	const { track, streams } = event;
	const isScreen = streams.some((stream) => stream.id === sharedStreamId);
	const stream = new MediaStream([track]);
	if (track.kind === "audio") {
		const key = isScreen ? "screenAudioStream" : "audioStream";
		update({ [key]: stream });
		track.onended = () => update({ [key]: null });
		return;
	}
	if (isScreen) {
		update({ screenStream: stream, sharing: true });
		track.onended = () =>
			update({
				screenStream: null,
				screenAudioStream: null,
				sharing: false,
			});
		return;
	}
	update({ cameraStream: stream });
	track.onended = () => update({ cameraStream: null });
}
