export type MediaDevicePreferences = {
	audioInputDeviceId: string | null;
	audioOutputDeviceId: string | null;
	videoInputDeviceId: string | null;
};

export const defaultMediaDevicePreferences: MediaDevicePreferences = {
	audioInputDeviceId: null,
	audioOutputDeviceId: null,
	videoInputDeviceId: null,
};

const STORAGE_KEY = "huddle-media-device-preferences";
export function readMediaDevicePreferences(): MediaDevicePreferences {
	try { return { ...defaultMediaDevicePreferences, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<MediaDevicePreferences>) }; } catch { return defaultMediaDevicePreferences; }
}
export function writeMediaDevicePreferences(value: MediaDevicePreferences) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("huddle-audio-output-change")); }

export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
	if (!navigator.mediaDevices?.enumerateDevices) return [];
	return navigator.mediaDevices.enumerateDevices();
}

export function deviceLabel(device: MediaDeviceInfo): string {
	return device.label || `${device.kind === "videoinput" ? "Câmera" : device.kind === "audiooutput" ? "Saída de áudio" : "Microfone"} padrão`;
}

export async function applyAudioOutput(element: HTMLMediaElement, deviceId: string | null) {
	if (!deviceId || !("setSinkId" in element)) return false;
	try {
		await (element as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
		return true;
	} catch {
		return false;
	}
}
