import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import { CallRoom } from "@/components/call-room";
import { CallAudioSession } from "@/components/call/call-media";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/user-avatar";
import type { useDirectCalls } from "@/hooks/use-direct-calls";
import type { User } from "@/lib/api";

type Props = { calls: ReturnType<typeof useDirectCalls>; user: User };

export function DirectCallPanel({ calls, user }: Props) {
	const [minimized, setMinimized] = useState(false);
	const { call, realtime, error, busy, accept, end } = calls;
	useEffect(() => setMinimized(false), [call?.id]);
	if (!call)
		return error ? (
			<p
				role="alert"
				className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-(--line) bg-(--canvas) p-4 text-sm"
			>
				{error}
			</p>
		) : null;
	const incoming = call.recipient.id === user.id;
	const peer = incoming ? call.caller : call.recipient;
	const active = call.status === "accepted";
	const close = () => {
		if (active) setMinimized(true);
		else void end();
	};

	return (
		<>
			<CallAudioSession
				peers={realtime.peers}
				enabled={active && minimized}
			/>
			{minimized && (
				<button
					type="button"
					onClick={() => setMinimized(false)}
					className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-(--brand) px-4 py-3 font-bold shadow-xl"
				>
					<Phone className="size-4" />
					Chamada com {peer.displayName}
				</button>
			)}
			<Modal
				open={!minimized}
				onClose={close}
				title={`Chamada com ${peer.displayName}`}
				description={
					active
						? "Conversa privada"
						: "Chamada privada · convite expira em 30 segundos"
				}
				wide={active}
			>
				{error && (
					<p role="alert" className="mb-4 text-sm text-red-600">
						{error}
					</p>
				)}
				{active ? (
					<CallRoom
						title="Chamada privada"
						user={user}
						connected={realtime.connected}
						inCall={realtime.inCall}
						joining={realtime.joining}
						error={realtime.error}
						muted={realtime.muted}
						serverMuted={false}
						cameraOff={realtime.cameraOff}
						sharing={realtime.sharing}
						localMediaStream={realtime.localMediaStream}
						localDisplayStream={realtime.localDisplayStream}
						peers={realtime.peers}
						canMuteParticipants={false}
						onLeave={() => void end()}
						onToggleMute={realtime.toggleMute}
						onToggleCamera={() => void realtime.toggleCamera()}
						onToggleShare={() => void realtime.toggleShare()}
						onChangeDevice={(kind, id) =>
							void realtime.changeDevice(kind, id)
						}
					/>
				) : (
					<div className="space-y-6 py-5 text-center">
						<UserAvatar user={peer} className="mx-auto size-20" />
						<p role="status">
							{incoming
								? `${peer.displayName} está chamando você`
								: `Chamando ${peer.displayName}...`}
						</p>
						<div className="flex justify-center gap-3">
							{incoming && (
								<button
									type="button"
									disabled={busy}
									onClick={() => void accept()}
									className="flex items-center gap-2 rounded-xl bg-(--brand) px-4 py-3 font-bold"
								>
									<Phone className="size-4" />
									Aceitar chamada
								</button>
							)}
							<button
								type="button"
								onClick={() => void end()}
								className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white"
							>
								<PhoneOff className="size-4" />
								{incoming
									? "Recusar chamada"
									: "Cancelar chamada"}
							</button>
						</div>
					</div>
				)}
				{active && !realtime.inCall && (
					<button
						type="button"
						onClick={() => void end()}
						className="mt-4 rounded-xl bg-red-600 px-4 py-2 font-bold text-white"
					>
						Encerrar chamada
					</button>
				)}
			</Modal>
		</>
	);
}
