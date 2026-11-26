export const CALL_SOUNDS = {
	join: { frequencies: [660, 880], duration: 0.12 },
	leave: { frequencies: [440, 330], duration: 0.16 },
} as const;

let callSoundContext: AudioContext | null = null;

function getCallSoundContext() {
	if (callSoundContext) return callSoundContext;
	try {
		const AudioContextConstructor = window.AudioContext;
		if (!AudioContextConstructor) return null;
		callSoundContext = new AudioContextConstructor();
	} catch {
		return null;
	}
	return callSoundContext;
}

export function unlockCallSounds() {
	const context = getCallSoundContext();
	if (context?.state === "suspended") void context.resume().catch(() => undefined);
}

export function playCallSound(kind: keyof typeof CALL_SOUNDS) {
	const context = getCallSoundContext();
	if (!context) return;
	const sound = CALL_SOUNDS[kind];
	const play = () => {
		if (!callSoundContext || callSoundContext.state !== "running") return;
		const startAt = callSoundContext.currentTime;
	sound.frequencies.forEach((frequency, index) => {
		const oscillator = callSoundContext!.createOscillator();
		const gain = callSoundContext!.createGain();
		const start = startAt + index * sound.duration;
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.duration - 0.01);
		oscillator.connect(gain).connect(callSoundContext!.destination);
		oscillator.start(start);
		oscillator.stop(start + sound.duration);
	});
	};
	if (context.state === "running") play();
	else void context.resume().then(play).catch(() => undefined);
}
