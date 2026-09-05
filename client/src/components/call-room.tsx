import {
	Mic,
	MicOff,
	Minus,
	MonitorUp,
	PhoneOff,
	Plus,
	RotateCcw,
	Users,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CallControl } from "@/components/call/call-controls";
import { PeerAudio, StreamVideo } from "@/components/call/call-media";
import { Participant } from "@/components/call/call-participants";
import type { User } from "@/lib/api";
import type { RealtimePeer } from "@/types/realtime";

export type CallPeer = RealtimePeer;

type CallRoomProps = {
	cameraOff: boolean;
	error: string | null;
	inCall: boolean;
	localDisplayStream: MediaStream | null;
	localMediaStream: MediaStream | null;
	muted: boolean;
	onLeave: () => void;
	onToggleCamera: () => void;
	onToggleMute: () => void;
	onToggleShare: () => void;
	peers: CallPeer[];
	sharing: boolean;
	user: User;
};

const MIN_ZOOM = 75;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

export function CallRoom(props: CallRoomProps) {
	const [selectedScreenName, setSelectedScreenName] = useState<string | null>(null);
	const [zoom, setZoom] = useState(100);
	const sharedScreens = useMemo(
		() => [
			...(props.localDisplayStream
				? [{ name: props.user.displayName, stream: props.localDisplayStream }]
				: []),
			...props.peers.flatMap((peer) =>
				peer.screenStream
					? [{ name: peer.user.displayName, stream: peer.screenStream }]
					: [],
			),
		],
		[props.localDisplayStream, props.peers, props.user.displayName],
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

	const changeZoom = (amount: number) => {
		setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
	};

	return (
		<div className="flex min-h-full flex-col gap-4">
			<header className="flex flex-wrap items-center gap-3">
				<div>
					<h1 className="text-xl font-black">Chamada do canal</h1>
					<p className="text-sm text-(--muted-text)">
						{props.inCall
							? `${props.peers.length + 1} ${props.peers.length ? "pessoas conectadas" : "pessoa conectada"}`
							: "Conectando ao canal de voz..."}
					</p>
				</div>

				{props.inCall && (
					<div className="ml-auto flex items-center gap-2 rounded-2xl border border-(--line) bg-(--surface) p-2">
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
				<section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-3xl bg-[#10151b] text-white">
					{selectedScreen ? (
						<>
							<div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
								<strong className="mr-auto text-sm">Tela de {selectedScreen.name}</strong>
								<button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom === MIN_ZOOM} className="grid size-8 place-items-center rounded-lg bg-white/10 disabled:opacity-35" aria-label="Diminuir zoom"><Minus className="size-4" /></button>
								<span className="w-12 text-center text-xs font-bold">{zoom}%</span>
								<button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom === MAX_ZOOM} className="grid size-8 place-items-center rounded-lg bg-white/10 disabled:opacity-35" aria-label="Aumentar zoom"><Plus className="size-4" /></button>
								<button type="button" onClick={() => setZoom(100)} className="grid size-8 place-items-center rounded-lg bg-white/10" aria-label="Restaurar zoom"><RotateCcw className="size-4" /></button>
							</div>
							<div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-black p-3">
								<StreamVideo
									stream={selectedScreen.stream}
									muted
									className="max-w-none object-contain transition-[width] duration-200"
									style={{ width: `${zoom}%` }}
								/>
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
						<Participant user={props.user} stream={props.localMediaStream} cameraOff={props.cameraOff} muted={props.muted} self />
						{props.peers.map((peer) => <Participant key={peer.user.id} user={peer.user} stream={peer.cameraStream} />)}
					</div>
				</aside>
			</div>

			{props.peers.map((peer) => <PeerAudio key={`audio-${peer.user.id}`} stream={peer.audioStream} />)}
		</div>
	);
}
