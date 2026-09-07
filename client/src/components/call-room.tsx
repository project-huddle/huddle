import {
	Mic,
	MicOff,
	Maximize,
	Minimize,
	Minus,
	MonitorUp,
	PhoneOff,
	Plus,
	RotateCcw,
	LoaderCircle,
	Users,
	Video,
	VideoOff,
	Settings2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CallControl } from "@/components/call/call-controls";
import { AudioOutput, StreamVideo } from "@/components/call/call-media";
import { Participant } from "@/components/call/call-participants";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/api";
import type { RealtimePeer } from "@/types/realtime";
import { listMediaDevices, deviceLabel, readMediaDevicePreferences, writeMediaDevicePreferences } from "@/lib/media-devices";

export type CallPeer = RealtimePeer;

type CallRoomProps = {
	cameraOff: boolean;
	connected: boolean;
	error: string | null;
	inCall: boolean;
	joining: boolean;
	localDisplayStream: MediaStream | null;
	localMediaStream: MediaStream | null;
	muted: boolean;
	serverMuted: boolean;
	onLeave: () => void;
	onToggleCamera: () => void;
	onToggleMute: () => void;
	onToggleShare: () => void;
	onMuteParticipant?: (userId: string, muted: boolean) => void;
	onChangeDevice?: (kind: "audioInputDeviceId" | "videoInputDeviceId" | "audioOutputDeviceId", id: string | null) => void;
	peers: CallPeer[];
	sharing: boolean;
	user: User;
};

const MIN_ZOOM = 75;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

export function CallRoom(props: CallRoomProps) {
	const [selectedScreenName, setSelectedScreenName] = useState<string | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [zoom, setZoom] = useState(100);
	const [screenMuted, setScreenMuted] = useState(false);
	const [screenVolume, setScreenVolume] = useState(100);
	const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
	const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({});
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [devicePrefs, setDevicePrefs] = useState(readMediaDevicePreferences);
	const [devicesOpen, setDevicesOpen] = useState(false);
	useEffect(() => { void listMediaDevices().then(setDevices); }, []);
	const updateDevice = (kind: "audioInputDeviceId" | "videoInputDeviceId" | "audioOutputDeviceId", id: string | null) => { const next = { ...devicePrefs, [kind]: id }; setDevicePrefs(next); writeMediaDevicePreferences(next); props.onChangeDevice?.(kind, id); };
	const screenPanelRef = useRef<HTMLElement>(null);
	const peers = useMemo(
		() => [
			...new Map(
				props.peers
					.filter((peer) => peer.user.id !== props.user.id)
					.map((peer) => [peer.user.id, peer]),
			).values(),
		],
		[props.peers, props.user.id],
	);
	const sharedScreens = useMemo(
		() => [
			...(props.localDisplayStream
				? [{ name: props.user.displayName, stream: props.localDisplayStream, audioStream: props.localDisplayStream }]
				: []),
			...peers.flatMap((peer) =>
				peer.screenStream
					? [{ name: peer.user.displayName, stream: peer.screenStream, audioStream: peer.screenAudioStream }]
					: [],
			),
		],
		[peers, props.localDisplayStream, props.user.displayName],
	);
	const selectedScreen =
		sharedScreens.find(({ name }) => name === selectedScreenName) ??
		sharedScreens[0] ??
		null;

	useEffect(() => {
		if (!selectedScreen) {
			setSelectedScreenName(null);
			setZoom(100);
		}
	}, [selectedScreen]);

	useEffect(() => {
		const updateFullscreenState = () => {
			setIsFullscreen(document.fullscreenElement === screenPanelRef.current);
		};

		document.addEventListener("fullscreenchange", updateFullscreenState);
		return () => {
			document.removeEventListener("fullscreenchange", updateFullscreenState);
		};
	}, []);

	const changeZoom = (amount: number) => {
		setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
	};

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				return;
			}

			await screenPanelRef.current?.requestFullscreen();
		} catch {
			// Fullscreen can be denied by browser or operating-system policy.
		}
	};

	return (
		<div className="flex min-h-full flex-col gap-4">
			<header className="flex flex-wrap items-center gap-3">
				<div>
					<h1 className="text-xl font-black">Chamada do canal</h1>
					<p className="text-sm text-(--muted-text)">
						{props.inCall
							? `${peers.length + 1} ${peers.length ? "pessoas conectadas" : "pessoa conectada"}`
							: props.joining
								? "Entrando na chamada..."
								: "Conectando ao canal de voz..."}
					</p>
				</div>
				{!props.inCall && !props.error && (
					<div className="ml-auto flex items-center gap-2 rounded-full bg-(--surface) px-3 py-2 text-xs font-semibold text-(--muted-text)">
						<LoaderCircle className="size-4 animate-spin text-(--brand)" />
						{props.connected ? "Aguardando conexão..." : "Conectando..."}
					</div>
				)}

				{props.inCall && (
					<div className="ml-auto flex items-center gap-2 rounded-2xl border border-(--line) bg-(--surface) p-2">
						<CallControl label="Configurações de áudio e vídeo" onClick={() => setDevicesOpen(true)} icon={<Settings2 />} />
						<CallControl active={props.muted} label={props.muted ? "Ativar microfone" : "Silenciar"} onClick={props.onToggleMute} icon={props.muted ? <MicOff /> : <Mic />} />
						<CallControl active={props.cameraOff} label={props.cameraOff ? "Ativar câmera" : "Desativar câmera"} onClick={props.onToggleCamera} icon={props.cameraOff ? <VideoOff /> : <Video />} />
						<CallControl active={props.sharing} label={props.sharing ? "Parar compartilhamento" : "Compartilhar tela"} onClick={props.onToggleShare} icon={<MonitorUp />} positive={props.sharing} />
						<CallControl label="Sair da chamada" onClick={props.onLeave} icon={<PhoneOff />} danger />
					</div>
				)}
			</header>
			{props.error && (
				<p role="alert" className="rounded-2xl border border-[#d75a4a]/25 bg-[#fff0ea] px-4 py-3 text-sm text-[#9c3f33]">
					{props.error}
				</p>
			)}

			<div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
				<section ref={screenPanelRef} className="flex min-h-105 min-w-0 flex-col overflow-hidden rounded-3xl bg-[#10151b] text-white">
					{selectedScreen ? (
						<>
							<div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
								<strong className="mr-auto text-sm">Tela de {selectedScreen.name}</strong>
								<button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom === MIN_ZOOM} className="grid size-8 place-items-center rounded-lg bg-white/10 disabled:opacity-35" aria-label="Diminuir zoom"><Minus className="size-4" /></button>
								<span className="w-12 text-center text-xs font-bold">{zoom}%</span>
								<button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom === MAX_ZOOM} className="grid size-8 place-items-center rounded-lg bg-white/10 disabled:opacity-35" aria-label="Aumentar zoom"><Plus className="size-4" /></button>
								<button type="button" onClick={() => setZoom(100)} className="grid size-8 place-items-center rounded-lg bg-white/10" aria-label="Restaurar zoom"><RotateCcw className="size-4" /></button>
								{selectedScreen.stream.getAudioTracks().length > 0 && <><button type="button" onClick={() => setScreenMuted((value) => !value)} className="rounded-lg bg-white/10 px-2 py-2 text-xs">{screenMuted ? "Ativar som" : "Mutar tela"}</button><label className="flex items-center gap-2 text-xs">Volume <input aria-label="Volume da transmissão" type="range" min="0" max="100" value={screenVolume} onChange={(event) => setScreenVolume(Number(event.target.value))} /></label></>}
								<button type="button" onClick={() => void toggleFullscreen()} className="grid size-8 place-items-center rounded-lg bg-white/10" aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>
									{isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
								</button>
							</div>
							<div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-black p-3">
								<StreamVideo
									stream={selectedScreen.stream}
									muted
									className="max-w-none object-contain transition-[width] duration-200"
									style={{ width: `${zoom}%` }}
								/>
								<AudioOutput stream={selectedScreen.audioStream} volume={screenVolume / 100} muted={screenMuted} />
							</div>
							{sharedScreens.length > 1 && (
								<div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
									{sharedScreens.map((screen) => (
										<button key={screen.name} type="button" onClick={() => { setSelectedScreenName(screen.name); setZoom(100); }} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${screen.name === selectedScreen.name ? "bg-(--brand) text-(--ink)" : "bg-white/10"}`}>Tela de {screen.name}</button>
									))}
								</div>
							)}
						</>
					) : (
						<div className="grid flex-1 place-items-center p-8 text-center">
							<div>
								<MonitorUp className="mx-auto size-10 text-white/35" />
								<p className="mt-4 font-bold">Nenhuma tela compartilhada</p>
								<p className="mt-1 text-sm text-white/50">Compartilhe uma janela ou tela para apresentá-la em destaque.</p>
							</div>
						</div>
					)}
				</section>

				<aside className="min-h-0 overflow-y-auto">
					<p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-(--muted-text)">
						<Users className="size-4" /> Participantes
					</p>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
						<Participant user={props.user} stream={props.localMediaStream} cameraOff={props.cameraOff} muted={props.muted || props.serverMuted} speaking={false} self />
						{peers.map((peer) => <Participant key={peer.user.id} user={peer.user} stream={peer.cameraStream} muted={peer.muted} speaking={speakingUsers[peer.user.id] ?? false} volume={peerVolumes[peer.user.id] ?? 100} onVolumeChange={(value) => setPeerVolumes((items) => ({ ...items, [peer.user.id]: value }))} onMute={() => props.onMuteParticipant?.(peer.user.id, !peer.serverMuted)} />)}
					</div>
				</aside>
			</div>

			{peers.map((peer) => <AudioOutput key={`audio-${peer.user.id}`} stream={peer.audioStream} volume={(peerVolumes[peer.user.id] ?? 100) / 100} muted={peer.muted} onSpeaking={(speaking) => setSpeakingUsers((items) => items[peer.user.id] === speaking ? items : ({ ...items, [peer.user.id]: speaking }))} />)}
			<Modal open={devicesOpen} onClose={() => setDevicesOpen(false)} title="Dispositivos da call" description="Escolha o microfone, a câmera e a saída de áudio. As alterações são aplicadas imediatamente.">
				<div className="space-y-4"><DeviceSelect label="Microfone" kind="audioinput" devices={devices} value={devicePrefs.audioInputDeviceId} onChange={(id) => updateDevice("audioInputDeviceId", id)} /><DeviceSelect label="Câmera" kind="videoinput" devices={devices} value={devicePrefs.videoInputDeviceId} onChange={(id) => updateDevice("videoInputDeviceId", id)} /><DeviceSelect label="Saída de áudio" kind="audiooutput" devices={devices} value={devicePrefs.audioOutputDeviceId} onChange={(id) => updateDevice("audioOutputDeviceId", id)} /></div>
			</Modal>
		</div>
	);
}

function DeviceSelect({ label, kind, devices, value, onChange }: { label: string; kind: MediaDeviceKind; devices: MediaDeviceInfo[]; value: string | null; onChange: (value: string | null) => void }) {
	return <label className="block text-sm font-bold">{label}<select aria-label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--canvas) px-3"><option value="">Padrão do sistema</option>{devices.filter((device) => device.kind === kind).map((device) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device)}</option>)}</select></label>;
}
