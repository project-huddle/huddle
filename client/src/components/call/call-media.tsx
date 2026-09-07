import { useEffect, useRef, type CSSProperties } from "react";
import { applyAudioOutput, readMediaDevicePreferences } from "@/lib/media-devices";

export function StreamVideo({ stream, muted = false, className, style }: { stream: MediaStream | null; muted?: boolean; className?: string; style?: CSSProperties }) {
	const ref = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = ref.current;
		if (video) video.srcObject = stream;
		return () => { if (video) video.srcObject = null; };
	}, [stream]);

	return <video ref={ref} autoPlay playsInline muted={muted} className={className} style={style} />;
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

export function AudioOutput({ stream, volume = 1, muted = false, onSpeaking }: { stream: MediaStream | null; volume?: number; muted?: boolean; onSpeaking?: (speaking: boolean) => void }) {
	const ref = useRef<HTMLAudioElement>(null);
	const speakingRef = useRef(onSpeaking);
	const gainRef = useRef<GainNode | null>(null);
	speakingRef.current = onSpeaking;
	useEffect(() => {
		const audio = ref.current;
		if (!audio || !stream || stream.getAudioTracks().length === 0) return;
		const context = new AudioContext();
		const source = context.createMediaStreamSource(stream);
		const gain = context.createGain();
		gainRef.current = gain;
		source.connect(gain).connect(context.destination);
		audio.srcObject = stream;
		audio.muted = true;
		void context.resume().catch(() => undefined);
		void applyAudioOutput(audio, readMediaDevicePreferences().audioOutputDeviceId);
		const updateOutput = () => void applyAudioOutput(audio, readMediaDevicePreferences().audioOutputDeviceId);
		window.addEventListener("huddle-audio-output-change", updateOutput);
		return () => { window.removeEventListener("huddle-audio-output-change", updateOutput); audio.srcObject = null; gain.disconnect(); source.disconnect(); gainRef.current = null; void context.close(); };
	}, [stream]);
	useEffect(() => {
		if (gainRef.current) gainRef.current.gain.value = muted ? 0 : Math.max(0, Math.min(2, volume));
	}, [muted, volume]);
	useEffect(() => {
		if (!stream || !speakingRef.current) return;
		const context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 256;
		const source = context.createMediaStreamSource(stream);
		source.connect(analyser);
		const data = new Uint8Array(analyser.frequencyBinCount);
		let frame = 0;
		const sample = () => {
			analyser.getByteTimeDomainData(data);
			let sum = 0;
			for (const value of data) sum += Math.abs(value - 128);
			speakingRef.current?.(sum / data.length > 8);
			frame = requestAnimationFrame(sample);
		};
		void context.resume();
		sample();
		return () => { cancelAnimationFrame(frame); source.disconnect(); analyser.disconnect(); void context.close(); };
	}, [stream]);
	return <audio ref={ref} autoPlay />;
}
