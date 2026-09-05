import { useEffect, useRef } from "react";

export function StreamVideo({ stream, muted = false, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
	const ref = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = ref.current;
		if (video) video.srcObject = stream;
		return () => { if (video) video.srcObject = null; };
	}, [stream]);

	return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

export function PeerAudio({ stream }: { stream: MediaStream | null }) {
	const ref = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		const audio = ref.current;
		if (audio) {
			audio.srcObject = stream;
			if (stream) void audio.play().catch(() => undefined);
		}
		return () => { if (audio) audio.srcObject = null; };
	}, [stream]);

	return <audio ref={ref} autoPlay />;
}
