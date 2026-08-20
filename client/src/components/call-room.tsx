import {
	Maximize2,
	Mic,
	MicOff,
	MonitorUp,
	PhoneOff,
	Users,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/api";
import type { RealtimePeer } from "@/types/realtime";
import { StreamVideo, PeerAudio } from "@/components/call/call-media";
import { Participant } from "@/components/call/call-participants";
import { CallControl } from "@/components/call/call-controls";

export type CallPeer = RealtimePeer;

type CallRoomProps = {
	cameraOff: boolean;
	inCall: boolean;
	localDisplayStream: MediaStream | null;
	localMediaStream: MediaStream | null;
	muted: boolean;
	onLeave: () => void;
	onToggleCamera: () => void;
	onToggleMute: () => void;
	onToggleShare: () => void;
	open: boolean;
	peers: CallPeer[];
	sharing: boolean;
	user: User;
	onClose: () => void;
};

export function CallRoom(props: CallRoomProps) {
	const [focusedScreen, setFocusedScreen] = useState<{
		name: string;
		stream: MediaStream;
	} | null>(null);
	const sharedScreens = useMemo(
		() => [
			...(props.localDisplayStream
				? [
						{
							name: `${props.user.displayName} (você)`,
							stream: props.localDisplayStream,
						},
					]
				: []),
			...props.peers.flatMap((peer) =>
				peer.screenStream
					? [
							{
								name: peer.user.displayName,
								stream: peer.screenStream,
							},
						]
					: [],
			),
		],
		[props.localDisplayStream, props.peers, props.user.displayName],
	);

	useEffect(() => {
		if (
			focusedScreen &&
			!sharedScreens.some(({ stream }) => stream === focusedScreen.stream)
		)
			setFocusedScreen(null);
	}, [focusedScreen, sharedScreens]);

	return (
		<>
			<Modal
				open={props.open && props.inCall}
				onClose={props.onClose}
				title="Chamada da sala"
				description={`${props.peers.length + 1} ${props.peers.length ? "pessoas conectadas" : "pessoa conectada"}`}
				wide
			>
				<div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
					<section className="min-h-80 overflow-hidden rounded-3xl bg-[#10151b] p-3 text-white sm:p-4">
						{sharedScreens.length ? (
							<div className="grid h-full gap-3">
								{sharedScreens.map(({ name, stream }) => (
									<div
										key={name}
										className="group relative grid min-h-72 place-items-center overflow-hidden rounded-2xl bg-black"
									>
										<StreamVideo
											stream={stream}
											muted
											className="max-h-[65svh] w-full object-contain"
										/>
										<div className="absolute inset-x-0 bottom-0 flex items-center bg-linear-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-sm font-semibold">
											Tela de {name}
											<button
												onClick={() =>
													setFocusedScreen({
														name,
														stream,
													})
												}
												className="ml-auto grid size-9 place-items-center rounded-xl bg-white/15 hover:bg-white/25"
												aria-label={`Expandir tela de ${name}`}
											>
												<Maximize2 className="size-4" />
											</button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="grid h-full min-h-80 place-items-center text-center">
								<div>
									<MonitorUp className="mx-auto size-9 text-white/45" />
									<p className="mt-4 font-bold">
										Nenhuma tela compartilhada
									</p>
									<p className="mt-1 text-sm text-white/55">
										Compartilhe uma janela ou tela para
										apresentá-la em destaque.
									</p>
								</div>
							</div>
						)}
					</section>

					<aside className="space-y-3">
						<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-(--muted-text)">
							<Users className="size-4" /> Participantes
						</p>
						<Participant
							user={props.user}
							stream={props.localMediaStream}
							cameraOff={props.cameraOff}
							muted={props.muted}
							self
						/>
						{props.peers.map((peer) => (
							<Participant
								key={peer.user.id}
								user={peer.user}
								stream={peer.cameraStream}
							/>
						))}
					</aside>
				</div>

				<div className="sticky bottom-0 mt-5 flex justify-center gap-2 rounded-2xl border border-(--line) bg-(--canvas)/95 p-2 shadow-lg backdrop-blur">
					<CallControl
						active={props.muted}
						label={props.muted ? "Ativar microfone" : "Silenciar"}
						onClick={props.onToggleMute}
						icon={props.muted ? <MicOff /> : <Mic />}
					/>
					<CallControl
						active={props.cameraOff}
						label={
							props.cameraOff
								? "Ativar câmera"
								: "Desativar câmera"
						}
						onClick={props.onToggleCamera}
						icon={props.cameraOff ? <VideoOff /> : <Video />}
					/>
					<CallControl
						active={props.sharing}
						label={
							props.sharing
								? "Parar compartilhamento"
								: "Compartilhar tela"
						}
						onClick={props.onToggleShare}
						icon={<MonitorUp />}
						positive={props.sharing}
					/>
					<CallControl
						label="Sair da chamada"
						onClick={props.onLeave}
						icon={<PhoneOff />}
						danger
					/>
				</div>
			</Modal>

			<Modal
				open={Boolean(focusedScreen)}
				onClose={() => setFocusedScreen(null)}
				title={
					focusedScreen
						? `Tela de ${focusedScreen.name}`
						: "Tela compartilhada"
				}
				wide
			>
				<div className="grid min-h-[60svh] place-items-center overflow-hidden rounded-2xl bg-black">
					<StreamVideo
						stream={focusedScreen?.stream ?? null}
						muted
						className="max-h-[75svh] w-full object-contain"
					/>
				</div>
			</Modal>

			{props.peers.map((peer) => (
				<PeerAudio
					key={`audio-${peer.user.id}`}
					stream={peer.audioStream}
				/>
			))}
		</>
	);
}
