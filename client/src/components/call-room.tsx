import { Maximize2, Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { Modal } from "@/components/ui/modal"
import { UserAvatar } from "@/components/user-avatar"
import type { User } from "@/lib/api"
import { cn } from "@/lib/utils"

export type CallPeer = {
  user: User
  audioStream: MediaStream | null
  cameraStream: MediaStream | null
  screenStream: MediaStream | null
  sharing: boolean
}

type CallRoomProps = {
  cameraOff: boolean
  inCall: boolean
  localDisplayStream: MediaStream | null
  localMediaStream: MediaStream | null
  muted: boolean
  onLeave: () => void
  onToggleCamera: () => void
  onToggleMute: () => void
  onToggleShare: () => void
  open: boolean
  peers: CallPeer[]
  sharing: boolean
  user: User
  onClose: () => void
}

function StreamVideo({ stream, muted = false, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (video) video.srcObject = stream
    return () => {
      if (video) video.srcObject = null
    }
  }, [stream])

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />
}

function PeerAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = ref.current
    if (audio) audio.srcObject = stream
    return () => {
      if (audio) audio.srcObject = null
    }
  }, [stream])
  return <audio ref={ref} autoPlay />
}

export function CallRoom(props: CallRoomProps) {
  const [focusedScreen, setFocusedScreen] = useState<{ name: string; stream: MediaStream } | null>(null)
  const sharedScreens = useMemo(() => [
    ...(props.localDisplayStream ? [{ name: `${props.user.displayName} (você)`, stream: props.localDisplayStream }] : []),
    ...props.peers.flatMap((peer) => peer.screenStream ? [{ name: peer.user.displayName, stream: peer.screenStream }] : []),
  ], [props.localDisplayStream, props.peers, props.user.displayName])

  useEffect(() => {
    if (focusedScreen && !sharedScreens.some(({ stream }) => stream === focusedScreen.stream)) setFocusedScreen(null)
  }, [focusedScreen, sharedScreens])

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
                  <div key={name} className="group relative grid min-h-72 place-items-center overflow-hidden rounded-2xl bg-black">
                    <StreamVideo stream={stream} muted className="max-h-[65svh] w-full object-contain" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center bg-linear-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-sm font-semibold">
                      Tela de {name}
                      <button onClick={() => setFocusedScreen({ name, stream })} className="ml-auto grid size-9 place-items-center rounded-xl bg-white/15 hover:bg-white/25" aria-label={`Expandir tela de ${name}`}>
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
                  <p className="mt-4 font-bold">Nenhuma tela compartilhada</p>
                  <p className="mt-1 text-sm text-white/55">Compartilhe uma janela ou tela para apresentá-la em destaque.</p>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-(--muted-text)"><Users className="size-4" /> Participantes</p>
            <Participant user={props.user} stream={props.localMediaStream} cameraOff={props.cameraOff} muted={props.muted} self />
            {props.peers.map((peer) => <Participant key={peer.user.id} user={peer.user} stream={peer.cameraStream} />)}
          </aside>
        </div>

        <div className="sticky bottom-0 mt-5 flex justify-center gap-2 rounded-2xl border border-(--line) bg-(--canvas)/95 p-2 shadow-lg backdrop-blur">
          <CallControl active={props.muted} label={props.muted ? "Ativar microfone" : "Silenciar"} onClick={props.onToggleMute} icon={props.muted ? <MicOff /> : <Mic />} />
          <CallControl active={props.cameraOff} label={props.cameraOff ? "Ativar câmera" : "Desativar câmera"} onClick={props.onToggleCamera} icon={props.cameraOff ? <VideoOff /> : <Video />} />
          <CallControl active={props.sharing} label={props.sharing ? "Parar compartilhamento" : "Compartilhar tela"} onClick={props.onToggleShare} icon={<MonitorUp />} positive={props.sharing} />
          <CallControl label="Sair da chamada" onClick={props.onLeave} icon={<PhoneOff />} danger />
        </div>
      </Modal>

      <Modal open={Boolean(focusedScreen)} onClose={() => setFocusedScreen(null)} title={focusedScreen ? `Tela de ${focusedScreen.name}` : "Tela compartilhada"} wide>
        <div className="grid min-h-[60svh] place-items-center overflow-hidden rounded-2xl bg-black">
          <StreamVideo stream={focusedScreen?.stream ?? null} muted className="max-h-[75svh] w-full object-contain" />
        </div>
      </Modal>

      {props.peers.map((peer) => <PeerAudio key={`audio-${peer.user.id}`} stream={peer.audioStream} />)}
    </>
  )
}

function Participant({ user, stream, cameraOff = false, muted = false, self = false }: { user: User; stream: MediaStream | null; cameraOff?: boolean; muted?: boolean; self?: boolean }) {
  return (
    <div className="relative flex min-h-28 items-end overflow-hidden rounded-2xl bg-(--solid) p-3 text-(--on-solid)">
      {stream && !cameraOff ? <StreamVideo stream={stream} muted={self} className="absolute inset-0 size-full object-cover" /> : <UserAvatar user={user} className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2" />}
      <span className="relative rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold">{self ? "Você" : user.displayName}</span>
      {muted && <MicOff className="relative ml-auto size-4" />}
    </div>
  )
}

function CallControl({ active, danger, icon, label, onClick, positive }: { active?: boolean; danger?: boolean; icon: ReactNode; label: string; onClick: () => void; positive?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cn("grid size-11 place-items-center rounded-2xl transition hover:-translate-y-0.5", danger ? "bg-[#d75a4a] text-white" : positive ? "bg-[#74a67d] text-white" : active ? "bg-[#d75a4a] text-white" : "bg-(--surface)")}>
      {icon}
    </button>
  )
}
