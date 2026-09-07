export const CALL_SOUNDS = {
	join: { frequencies: [660, 880], duration: 0.12 },
	leave: { frequencies: [440, 330], duration: 0.16 },
} as const;

export function playCallSound(kind: keyof typeof CALL_SOUNDS) {
	const sound = CALL_SOUNDS[kind];
	const context = new AudioContext();
	sound.frequencies.forEach((frequency, index) => {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const start = context.currentTime + index * sound.duration;
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.duration - 0.01);
		oscillator.connect(gain).connect(context.destination);
		oscillator.start(start);
		oscillator.stop(start + sound.duration);
	});
	setTimeout(() => void context.close(), sound.frequencies.length * sound.duration * 1000 + 100);
}
